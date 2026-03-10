import { Request, Response, NextFunction } from 'express'
import { logger } from '../lib/logger'

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  logger.error({ err, path: req.path }, 'Unhandled error')
  res.status(500).json({ error: 'Internal server error', message: err.message })
}
