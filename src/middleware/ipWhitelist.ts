import { Request, Response, NextFunction } from 'express'
import { config } from '../config/env'

export function ipWhitelist(req: Request, res: Response, next: NextFunction): void {
  if (config.allowedIps.length === 0) {
    next()
    return
  }

  const clientIp = req.ip ?? req.socket.remoteAddress ?? ''
  const normalized = clientIp.replace('::ffff:', '')

  if (!config.allowedIps.includes(normalized)) {
    res.status(403).json({ error: 'Forbidden' })
    return
  }

  next()
}
