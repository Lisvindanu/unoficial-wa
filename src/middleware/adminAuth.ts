import { Request, Response, NextFunction } from 'express'
import crypto from 'crypto'
import { config } from '../config/env'

const COOKIE_NAME = 'wa_admin'
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

function makeToken(): string {
  const exp = Date.now() + TOKEN_TTL_MS
  const sig = crypto
    .createHmac('sha256', config.adminPassword)
    .update(`${exp}.${config.adminUsername}`)
    .digest('hex')
  return Buffer.from(`${exp}.${sig}`).toString('base64url')
}

function verifyToken(token: string): boolean {
  try {
    const decoded = Buffer.from(token, 'base64url').toString()
    const dotIdx = decoded.indexOf('.')
    if (dotIdx === -1) return false

    const expStr = decoded.slice(0, dotIdx)
    const sig = decoded.slice(dotIdx + 1)
    const exp = parseInt(expStr, 10)

    if (isNaN(exp) || Date.now() > exp) return false

    const expected = crypto
      .createHmac('sha256', config.adminPassword)
      .update(`${exp}.${config.adminUsername}`)
      .digest('hex')

    return crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'))
  } catch {
    return false
  }
}

function parseCookies(header: string): Record<string, string> {
  const cookies: Record<string, string> = {}
  header.split(';').forEach(c => {
    const eqIdx = c.indexOf('=')
    if (eqIdx === -1) return
    const key = c.slice(0, eqIdx).trim()
    const val = c.slice(eqIdx + 1).trim()
    if (key) cookies[key] = decodeURIComponent(val)
  })
  return cookies
}

export function setAdminCookie(res: Response): void {
  const token = makeToken()
  const maxAge = TOKEN_TTL_MS / 1000
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}`)
}

export function clearAdminCookie(res: Response): void {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`)
}

export function getAdminToken(req: Request): string | undefined {
  const cookieHeader = req.headers.cookie || ''
  return parseCookies(cookieHeader)[COOKIE_NAME]
}

export function isAdminAuthenticated(req: Request): boolean {
  if (!config.adminPassword) return false
  const token = getAdminToken(req)
  return !!token && verifyToken(token)
}

export function adminAuth(req: Request, res: Response, next: NextFunction): void {
  if (!config.adminPassword) {
    res.status(503).send('Admin access is disabled: ADMIN_PASSWORD not configured.')
    return
  }

  if (!isAdminAuthenticated(req)) {
    const isApiCall = req.path.includes('/api/') || req.headers.accept?.includes('application/json')
    if (isApiCall) {
      res.status(401).json({ error: 'Unauthorized. Please login at /dashboard/login' })
    } else {
      res.redirect('/dashboard/login')
    }
    return
  }

  next()
}
