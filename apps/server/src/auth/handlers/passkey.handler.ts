import type { Request, Response, NextFunction } from 'express'
import { BadRequestError } from '../../shared/lib/errors.js'
import { parseBody, sendData } from '../../shared/lib/http.js'
import {
  passkeyLoginOptionsSchema,
  passkeyLoginVerifySchema,
  passkeyRegisterOptionsSchema,
  passkeyRegisterVerifySchema
} from '../schemas/passkey.schemas.js'
import {
  getLoginOptions,
  getRegisterOptions,
  listPasskeys,
  revokePasskey,
  verifyLogin,
  verifyRegister
} from '../services/passkey.service.js'

export async function passkeyRegisterOptionsHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    parseBody(passkeyRegisterOptionsSchema, req.body ?? {})
    const options = await getRegisterOptions({
      userId: req.auth!.userId,
      ipAddress: req.ip
    })
    sendData(res, options)
  } catch (err) {
    next(err)
  }
}

export async function passkeyRegisterVerifyHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const body = parseBody(passkeyRegisterVerifySchema, req.body)
    const passkey = await verifyRegister({
      userId: req.auth!.userId,
      credential: body.credential,
      name: body.name,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    })
    sendData(res, passkey)
  } catch (err) {
    next(err)
  }
}

export async function passkeyLoginOptionsHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const body = parseBody(passkeyLoginOptionsSchema, req.body ?? {})
    const options = await getLoginOptions({
      email: body.email,
      ipAddress: req.ip
    })
    sendData(res, options)
  } catch (err) {
    next(err)
  }
}

export async function passkeyLoginVerifyHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const body = parseBody(passkeyLoginVerifySchema, req.body)
    const tokens = await verifyLogin({
      credential: body.credential,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    })
    sendData(res, tokens)
  } catch (err) {
    next(err)
  }
}

export async function passkeyListHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const data = await listPasskeys(req.auth!.userId)
    sendData(res, data)
  } catch (err) {
    next(err)
  }
}

export async function passkeyDeleteHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const passkeyId = req.params.id
    if (typeof passkeyId !== 'string' || !passkeyId) {
      throw new BadRequestError('Passkey id is required', 'VALIDATION_ERROR')
    }
    const data = await revokePasskey({
      userId: req.auth!.userId,
      passkeyId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    })
    sendData(res, data)
  } catch (err) {
    next(err)
  }
}
