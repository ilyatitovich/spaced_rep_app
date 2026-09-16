import type { Request, Response, NextFunction } from 'express'
import {
  PROTOCOL_VERSION,
  SyncEnvelopeSchema,
  createEnvelopeId,
  type SyncEnvelope
} from '@spaced-rep/sync-protocol'
import { enforceRateLimit } from '../../shared/lib/redis.js'
import { BadRequestError } from '../../shared/lib/errors.js'
import { parseBody } from '../../shared/lib/http.js'
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

function sendEnvelope(res: Response, envelope: SyncEnvelope): void {
  res.status(200).json(envelope)
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
      // Burst drain after sign-in can need many batches (50 ops each).
      limit: 500,
      windowSeconds: 60,
      message: 'Sync rate limit exceeded'
    })

    const envelope = parseBody(SyncEnvelopeSchema, req.body)
    if (envelope.kind !== 'pushBatch') {
      throw new BadRequestError(
        'Expected PushBatch envelope',
        'VALIDATION_ERROR'
      )
    }

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
    const envelope = parseBody(SyncEnvelopeSchema, req.body)
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
    const envelope = parseBody(SyncEnvelopeSchema, req.body)

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
