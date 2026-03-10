import { Request, Response, NextFunction } from 'express'

interface RateLimitEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

export function rateLimit(options: { windowMs: number; max: number }) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = (req.ip ?? req.socket.remoteAddress ?? 'unknown').replace('::ffff:', '')
    const now = Date.now()

    let entry = store.get(ip)
    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + options.windowMs }
      store.set(ip, entry)
    }

    entry.count++

    res.setHeader('X-RateLimit-Limit', options.max)
    res.setHeader('X-RateLimit-Remaining', Math.max(0, options.max - entry.count))
    res.setHeader('X-RateLimit-Reset', Math.ceil(entry.resetAt / 1000))

    if (entry.count > options.max) {
      res.status(429).json({
        error: 'Too Many Requests',
        retryAfter: Math.ceil((entry.resetAt - now) / 1000)
      })
      return
    }

    next()
  }
}

// Cleanup expired entries every minute
setInterval(() => {
  const now = Date.now()
  for (const [ip, entry] of store.entries()) {
    if (now > entry.resetAt) store.delete(ip)
  }
}, 60_000)
