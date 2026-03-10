import { SessionManager, mapStatus } from './sessionManager'
import { usePostgresAuthState } from './authAdapter'
import { createSocket } from './socketFactory'
import { prisma } from '../lib/prisma'
import { logger } from '../lib/logger'
import { config } from '../config/env'

export interface StartOptions {
  name?: string
  webhookUrl?: string
  webhookSecret?: string
}

export async function startSession(sessionId: string, opts: StartOptions = {}) {
  const { name, webhookUrl, webhookSecret } = opts

  await prisma.session.upsert({
    where: { id: sessionId },
    update: { name: name ?? null, status: 'pending', webhookUrl: webhookUrl ?? null, webhookSecret: webhookSecret ?? null },
    create: { id: sessionId, name: name ?? null, status: 'pending', webhookUrl: webhookUrl ?? null, webhookSecret: webhookSecret ?? null }
  })

  const { state, saveCreds } = await usePostgresAuthState(sessionId)
  const sock = await createSocket(sessionId, state, saveCreds)

  SessionManager.set(sessionId, {
    socket: sock,
    status: 'pending',
    name: name ?? undefined,
    webhookUrl: webhookUrl ?? undefined,
    webhookSecret: webhookSecret ?? undefined
  })

  logger.info({ sessionId, name }, 'Session starting')
}

export async function stopSession(sessionId: string) {
  SessionManager.delete(sessionId)
  await prisma.session.update({
    where: { id: sessionId },
    data: { status: 'disconnected' }
  }).catch(() => { })
  logger.info({ sessionId }, 'Session stopped')
}

export async function restartSession(sessionId: string) {
  const existing = SessionManager.get(sessionId)
  if (!existing) throw new Error('Session not found')

  const { name, webhookUrl, webhookSecret } = existing

  SessionManager.delete(sessionId)
  await prisma.session.update({
    where: { id: sessionId },
    data: { status: 'pending' }
  }).catch(() => { })

  const { state, saveCreds } = await usePostgresAuthState(sessionId)
  const sock = await createSocket(sessionId, state, saveCreds)
  SessionManager.set(sessionId, { socket: sock, status: 'pending', name, webhookUrl, webhookSecret })

  logger.info({ sessionId }, 'Session restarted')
}

export async function logoutSession(sessionId: string) {
  SessionManager.delete(sessionId)
  // Delete all auth keys so next start requires QR scan
  await prisma.authKey.deleteMany({ where: { sessionId } })
  await prisma.session.update({
    where: { id: sessionId },
    data: { status: 'disconnected' }
  }).catch(() => { })
  logger.info({ sessionId }, 'Session logged out')
}

export function canStart(): boolean {
  return SessionManager.count() < config.maxSessions
}

/** Normalize chatId: 628xxx@c.us → 628xxx@s.whatsapp.net */
export function normalizeChatId(chatId: string): string {
  return chatId.replace(/@c\.us$/, '@s.whatsapp.net')
}
