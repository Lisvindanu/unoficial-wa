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
    id,
    status: s.status,
    phoneNumber: s.phoneNumber ?? null,
    name: s.name ?? null
  })),

  count: () => sessions.size
}
