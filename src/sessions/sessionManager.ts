export interface SessionEntry {
  socket: any
  status: 'pending' | 'connected' | 'disconnected'
  phoneNumber?: string
  qr?: string
  qrRaw?: string
  name?: string
  webhookUrl?: string
  webhookSecret?: string
}

export function mapStatus(session: SessionEntry): string {
  switch (session.status) {
    case 'connected': return 'WORKING'
    case 'pending': return session.qr ? 'SCAN_QR_CODE' : 'STARTING'
    case 'disconnected': return 'STOPPED'
    default: return 'STOPPED'
  }
}

export function buildMe(session: SessionEntry): { id: string | null; lid: null; jid: string | null; pushName: string | null } | null {
  if (session.status !== 'connected') return null
  const user = session.socket?.user
  const rawId: string | undefined = user?.id  // "628xxx:0@s.whatsapp.net"
  const phone = rawId?.split(':')[0] ?? session.phoneNumber ?? null
  return {
    id: phone ? `${phone}@c.us` : null,
    lid: null,
    jid: rawId ?? null,
    pushName: user?.name ?? null
  }
}

const sessions = new Map<string, SessionEntry>()

export const SessionManager = {
  set: (id: string, entry: SessionEntry) => sessions.set(id, entry),

  get: (id: string) => sessions.get(id),

  update: (id: string, patch: Partial<SessionEntry>) => {
    const existing = sessions.get(id)
    if (existing) sessions.set(id, { ...existing, ...patch })
  },

  delete: (id: string) => {
    const entry = sessions.get(id)
    if (entry) {
      try { entry.socket.end(undefined) } catch { /* ignore */ }
      sessions.delete(id)
    }
  },

  has: (id: string) => sessions.has(id),

  getAll: () => Array.from(sessions.entries()).map(([id, s]) => ({
    name: s.name ?? id,
    status: mapStatus(s),
    me: buildMe(s),
    engine: { engine: 'NOWEB', state: mapStatus(s) }
  })),

  count: () => sessions.size
}
