import { Request, Response, NextFunction } from 'express'
import crypto from 'crypto'
import { config } from '../config/env'

export function apiKeyAuth(req: Request, res: Response, next: NextFunction): void {
  // Express lowercases all headers; both X-Api-Key and X-API-Key map to 'x-api-key'
  const key = req.headers['x-api-key']
  if (!key || !config.apiKey) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const keyBuf = Buffer.from(String(key))
    const validBuf = Buffer.from(config.apiKey)
    if (keyBuf.length !== validBuf.length || !crypto.timingSafeEqual(keyBuf, validBuf)) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }
  } catch {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  next()
}
