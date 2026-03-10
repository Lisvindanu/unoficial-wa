import { Response } from 'express'

const clients = new Set<Response>()

export const SseEventBus = {
  subscribe: (res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.flushHeaders()
    clients.add(res)
    res.on('close', () => clients.delete(res))
  },

  publish: (event: string, data: object) => {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
    clients.forEach(res => {
      try { res.write(payload) } catch { clients.delete(res) }
    })
  },

  clientCount: () => clients.size
}
