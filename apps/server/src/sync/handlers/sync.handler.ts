import type { Request, Response, NextFunction } from 'express'
import {
  PROTOCOL_VERSION,
  createEnvelopeId,
  decodeEnvelope,
  encodeEnvelope,
  type SyncEnvelope
} from '@spaced-rep/sync-protocol'
import { enforceRateLimit } from '../../shared/lib/redis.js'
import { BadRequestError } from '../../shared/lib/errors.js'
import {
  applyPushBatch,
  bootstrap,
  finishSyncCycle,
  pullChanges
} from '../sync.service.js'

function requireAuthUser(req: Request): { userId: string } {
  if (!req.auth?.userId) {
    throw new BadRequestError('Unauthorized', 'UNAUTHORIZED')
  }
  return { userId: req.auth.userId }
}

async function readBinaryBody(req: Request): Promise<Uint8Array> {
  if (Buffer.isBuffer(req.body)) {
    return new Uint8Array(req.body)
  }
  if (req.body instanceof Uint8Array) {
    return req.body
  }
  throw new BadRequestError(
    'Expected application/x-protobuf body',
    'VALIDATION_ERROR'
  )
}

function sendProtobuf(res: Response, envelope: SyncEnvelope): void {
  const bytes = encodeEnvelope(envelope)
  res
    .status(200)
    .set('Content-Type', 'application/x-protobuf')
    .send(Buffer.from(bytes))
}

export async function pushHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { userId } = requireAuthUser(req)
    await enforceRateLimit({
      key: `sync:push:${userId}`,
      limit: 100,
      windowSeconds: 60,
      message: 'Sync rate limit exceeded'
    })

    const bytes = await readBinaryBody(req)
    const envelope = decodeEnvelope(bytes)
    if (envelope.kind !== 'pushBatch') {
      throw new BadRequestError('Expected PushBatch envelope', 'VALIDATION_ERROR')
    }

    const ack = await applyPushBatch({
      userId,
      deviceId: envelope.deviceId,
      mutations: envelope.pushBatch.mutations
    })

    sendProtobuf(res, {
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
    const bytes = await readBinaryBody(req)
    const envelope = decodeEnvelope(bytes)
    if (envelope.kind !== 'pullRequest') {
      throw new BadRequestError(
        'Expected PullRequest envelope',
        'VALIDATION_ERROR'
      )
    }

    const delta = await pullChanges({
      userId,
      since: envelope.pullRequest.since
    })

    await finishSyncCycle({
      userId,
      deviceId: envelope.deviceId,
      lastPulledAt: delta.watermark,
      userAgent: req.get('user-agent')
    })

    sendProtobuf(res, {
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
    const bytes = await readBinaryBody(req)
    const envelope = decodeEnvelope(bytes)

    let lastPulledAt = new Date(0).toISOString()
    if (envelope.kind === 'hello') {
      lastPulledAt = envelope.hello.lastPulledAt
    } else if (envelope.kind === 'pullRequest') {
      lastPulledAt = envelope.pullRequest.since
    }

    const delta = await bootstrap({
      userId,
      deviceId: envelope.deviceId,
      lastPulledAt
    })

    sendProtobuf(res, {
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
