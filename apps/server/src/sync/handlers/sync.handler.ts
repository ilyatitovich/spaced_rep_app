import type { Request, Response, NextFunction } from 'express'
import {
  ClientIdSchema,
  INITIAL_CURSOR,
  PROTOCOL_VERSION,
  SyncEnvelopeSchema,
  createEnvelopeId,
  type SyncEnvelope
} from '@spaced-rep/sync-protocol'
import { BadRequestError } from '../../shared/lib/errors.js'
import { parseBody, sendData } from '../../shared/lib/http.js'
import { assertPlan } from '../../settings/services/plan.service.js'
import { revokeDeviceSchema } from '../schemas/sync.schemas.js'
import {
  applyPushBatch,
  bootstrap,
  finishSyncCycle,
  listSyncDevices,
  pullChanges,
  reportDevice,
  revokeSyncDevice
} from '../sync.service.js'
import { enforcePushRateLimit } from '../push-rate-limit.js'
import { disconnectSyncDevice } from '../ws.handler.js'

function requireAuthUser(req: Request): { userId: string } {
  if (!req.auth?.userId) {
    throw new BadRequestError('Unauthorized', 'UNAUTHORIZED')
  }
  return { userId: req.auth.userId }
}

function sendEnvelope(res: Response, envelope: SyncEnvelope): void {
  res.status(200).json(envelope)
}

/**
 * Version gate, then the request-only checks the shared envelope cannot make
 * (server frames may carry an empty `deviceId`): the sender's device id lands
 * in a Postgres `uuid` column, so a malformed one must be a 400, not a 500.
 */
function assertValidRequest(envelope: SyncEnvelope): void {
  if (envelope.version !== PROTOCOL_VERSION) {
    throw new BadRequestError(
      `Unsupported protocol version ${envelope.version}`,
      'PROTOCOL_MISMATCH'
    )
  }
  if (
    envelope.kind === 'hello' &&
    envelope.hello.protocolVersion !== PROTOCOL_VERSION
  ) {
    throw new BadRequestError(
      `Unsupported protocol version ${envelope.hello.protocolVersion}`,
      'PROTOCOL_MISMATCH'
    )
  }
  if (!ClientIdSchema.safeParse(envelope.deviceId).success) {
    throw new BadRequestError('deviceId must be a UUID', 'VALIDATION_ERROR')
  }
}

export async function pushHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { userId } = requireAuthUser(req)
    await assertPlan(userId, 'PRO')
    await enforcePushRateLimit(userId)

    const envelope = parseBody(SyncEnvelopeSchema, req.body)
    if (envelope.kind !== 'pushBatch') {
      throw new BadRequestError(
        'Expected PushBatch envelope',
        'VALIDATION_ERROR'
      )
    }
    assertValidRequest(envelope)

    await reportDevice({
      userId,
      deviceId: envelope.deviceId,
      userAgent: req.get('user-agent')
    })
    const ack = await applyPushBatch({
      userId,
      deviceId: envelope.deviceId,
      mutations: envelope.pushBatch.mutations
    })

    sendEnvelope(res, {
      version: PROTOCOL_VERSION,
      messageId: createEnvelopeId(),
      correlationId: envelope.messageId,
      deviceId: envelope.deviceId,
      sentAt: Date.now(),
      kind: 'pushAck',
      pushAck: ack
    })
  } catch (err) {
    next(err)
  }
}

export async function pullHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { userId } = requireAuthUser(req)
    await assertPlan(userId, 'PRO')
    const envelope = parseBody(SyncEnvelopeSchema, req.body)
    if (envelope.kind !== 'pullRequest') {
      throw new BadRequestError(
        'Expected PullRequest envelope',
        'VALIDATION_ERROR'
      )
    }
    assertValidRequest(envelope)

    const delta = await pullChanges({
      userId,
      since: envelope.pullRequest.since
    })

    await finishSyncCycle({
      userId,
      deviceId: envelope.deviceId,
      cursor: envelope.pullRequest.since,
      userAgent: req.get('user-agent')
    })

    sendEnvelope(res, {
      version: PROTOCOL_VERSION,
      messageId: createEnvelopeId(),
      correlationId: envelope.messageId,
      deviceId: envelope.deviceId,
      sentAt: Date.now(),
      kind: 'pullDelta',
      pullDelta: delta
    })
  } catch (err) {
    next(err)
  }
}

export async function bootstrapHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { userId } = requireAuthUser(req)
    await assertPlan(userId, 'PRO')
    const envelope = parseBody(SyncEnvelopeSchema, req.body)
    assertValidRequest(envelope)

    let cursor = INITIAL_CURSOR
    if (envelope.kind === 'hello') {
      cursor = envelope.hello.lastPulledAt
    } else if (envelope.kind === 'pullRequest') {
      cursor = envelope.pullRequest.since
    }

    const delta = await bootstrap({
      userId,
      deviceId: envelope.deviceId,
      cursor,
      userAgent: req.get('user-agent')
    })

    sendEnvelope(res, {
      version: PROTOCOL_VERSION,
      messageId: createEnvelopeId(),
      correlationId: envelope.messageId,
      deviceId: envelope.deviceId,
      sentAt: Date.now(),
      kind: 'pullDelta',
      pullDelta: delta
    })
  } catch (err) {
    next(err)
  }
}

export async function listDevicesHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { userId } = requireAuthUser(req)
    const devices = await listSyncDevices(userId)
    sendData(res, { devices })
  } catch (err) {
    next(err)
  }
}

export async function revokeDeviceHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { userId } = requireAuthUser(req)
    const body = parseBody(revokeDeviceSchema, req.body)
    const result = await revokeSyncDevice({ userId, ...body })
    if (result.revoked) disconnectSyncDevice(userId, body.deviceId)
    sendData(res, result)
  } catch (err) {
    next(err)
  }
}
