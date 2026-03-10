# WhatsApp Multi-Session API — Project Context

> Noweb REST API berbasis Baileys sebagai pengganti WAHA, dilengkapi minimal web dashboard dan Swagger API docs.

---

## 1. Ringkasan Proyek

Membangun **REST API** untuk otomasi WhatsApp multi-sesi yang:
- Beroperasi murni di level WebSocket (noweb/headless), **tanpa Puppeteer/Chrome**
- Menjadi **bridge** antara aplikasi utama ↔ jaringan WhatsApp
- Menggantikan WAHA dengan solusi custom yang lebih ringan dan terkontrol
- Dilengkapi **minimal web dashboard** untuk monitoring sesi dan live webhook log
- Dilengkapi **Swagger/OpenAPI UI** untuk dokumentasi dan testing endpoint interaktif

**Target spek server:** 50MB RAM per sesi (vs ~500MB jika pakai browser automation).

---

## 2. Tech Stack

| Layer | Teknologi | Alasan |
|---|---|---|
| Runtime | Node.js (v20+ LTS) | Event loop non-blocking, cocok untuk banyak koneksi WebSocket |
| Framework | Express.js | Ringan, middleware-centric, mudah dikustomisasi |
| WhatsApp Engine | `@whiskeysockets/baileys` (latest) | Native WebSocket, no browser, noweb mode |
| ORM | Prisma | Type-safe, migration management, connection pooling |
| Database | PostgreSQL | ACID compliance, aman untuk kunci kriptografi |
| Process Manager | PM2 | Memory limit restart, clustering, auto-restart |
| Reverse Proxy | Nginx | SSL termination, rate limiting, IP filtering |
| HTTP Client | Axios + `axios-retry` | Webhook dispatcher dengan exponential backoff |
| **API Docs** | **`swagger-ui-express` + `swagger-jsdoc`** | **OpenAPI 3.0 spec auto-generated dari JSDoc** |
| **Dashboard** | **Vanilla HTML/CSS/JS (served by Express)** | **Zero build step, ringan, tidak perlu React/Vite** |
| **Realtime Dashboard** | **Server-Sent Events (SSE)** | **Push event ke dashboard tanpa polling; lebih ringan dari WebSocket** |
| Env Config | dotenv | Manajemen secret dan konfigurasi |
| Language | TypeScript | Type safety untuk state management yang kompleks |

---

## 3. Arsitektur Sistem

```
[Aplikasi Utama/Eksternal]          [Browser Admin/Developer]
        │                                      │
        │ HTTP POST (+ x-api-key header)        │ Browser (no auth / basic auth)
        ▼                                      ▼
[Nginx Reverse Proxy]  ← SSL termination, rate limiting
        │
        ▼
[Express.js API Server]
        │
        ├── Middleware: API Key Validation    (hanya untuk /api/* routes)
        ├── Middleware: IP Whitelist Check    (hanya untuk /api/* routes)
        │
        ├── /api/*          → REST API (protected)
        ├── /docs           → Swagger UI (OpenAPI 3.0)
        ├── /dashboard      → Minimal Web Dashboard (static HTML)
        └── /dashboard/events → SSE stream (realtime sesi + webhook log)
        │
        ▼
[Session Router]  ← Map<sessionId, BaileysSocket>
        │
        ├── POST /api/sessions/start     → init socket + return QR base64
        ├── POST /api/sessions/stop      → disconnect + cleanup
        ├── GET  /api/sessions/:id/status
        ├── GET  /api/sessions            → list all
        ├── POST /api/messages/send      → sock.sendMessage()
        └── POST /api/messages/send-media
        │
        ▼
[Baileys WebSocket Engine]  ← noweb mode, direct Signal protocol
        │
        ├── Auth State → PostgreSQL (custom adapter)
        │
        └── Event Emitter:
            ├── connection.update  → QR / connected / disconnected
            ├── messages.upsert    → pesan masuk
            └── messages.update    → delivery/read receipt
                    │
                    ├── [Webhook Dispatcher] ──→ Aplikasi Utama
                    │   ├── HMAC-SHA256 signing
                    │   └── axios-retry + exponential backoff
                    │
                    └── [SSE Event Bus] ──→ Dashboard Browser
                        └── broadcast ke semua SSE clients
```

---

## 4. Struktur Direktori

```
whatsapp-api/
├── src/
│   ├── index.ts                  # Entry point, Express setup
│   ├── config/
│   │   ├── env.ts                # Validasi env variables
│   │   └── swagger.ts            # OpenAPI spec config (swagger-jsdoc)
│   ├── middleware/
│   │   ├── apiKeyAuth.ts         # Validasi x-api-key header
│   │   ├── ipWhitelist.ts        # IP whitelist check
│   │   └── errorHandler.ts
│   ├── sessions/
│   │   ├── sessionManager.ts     # Map<id, socket> + lifecycle management
│   │   ├── socketFactory.ts      # makeWASocket config + event listeners
│   │   └── authAdapter.ts        # Custom Prisma auth state (read/write)
│   ├── routes/
│   │   ├── sessions.ts           # /api/sessions/* endpoints
│   │   ├── messages.ts           # /api/messages/* endpoints
│   │   └── dashboard.ts          # /dashboard + /dashboard/events (SSE)
│   ├── sse/
│   │   └── eventBus.ts           # SSE broadcast ke semua connected browsers
│   ├── webhook/
│   │   ├── dispatcher.ts         # Axios + retry logic
│   │   └── signer.ts             # HMAC-SHA256 payload signing
│   └── lib/
│       └── logger.ts             # Structured logging (pino)
├── public/
│   └── dashboard/
│       ├── index.html            # Dashboard HTML (standalone, no framework)
│       ├── style.css             # Dashboard styles
│       └── app.js                # SSE client + DOM updates
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── ecosystem.config.js           # PM2 config (memory limits)
├── nginx.conf                    # Reverse proxy config
├── .env.example
├── package.json
└── tsconfig.json
```

---

## 5. Database Schema (Prisma)

```prisma
// prisma/schema.prisma

model Session {
  id          String   @id                    // sessionId dari caller
  status      String   @default("pending")    // pending | connected | disconnected
  phoneNumber String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  authKeys    AuthKey[]
}

model AuthKey {
  id        String   @id @default(cuid())
  sessionId String
  keyType   String                             // creds | pre-key | session-key, dst
  keyId     String                             // identifier dari Baileys
  keyData   Json                               // serialized key object
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  session   Session  @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  @@unique([sessionId, keyType, keyId])
  @@index([sessionId])
}
```

---

## 6. Implementasi Kunci

### 6.1 Custom Auth Adapter (PostgreSQL)

```typescript
// src/sessions/authAdapter.ts
import { prisma } from '../lib/prisma'
import { AuthenticationState, SignalDataTypeMap } from '@whiskeysockets/baileys'

export async function usePostgresAuthState(sessionId: string): Promise<{
  state: AuthenticationState
  saveCreds: () => Promise<void>
}> {
  // READ: ambil semua key dari DB untuk session ini
  const readData = async (type: string, ids: string[]) => {
    const rows = await prisma.authKey.findMany({
      where: { sessionId, keyType: type, keyId: { in: ids } }
    })
    return Object.fromEntries(rows.map(r => [r.keyId, r.keyData]))
  }

  // WRITE: upsert key ke DB (atomic, ACID-safe)
  const writeData = async (type: string, data: Record<string, unknown>) => {
    await Promise.all(
      Object.entries(data).map(([keyId, keyData]) =>
        prisma.authKey.upsert({
          where: { sessionId_keyType_keyId: { sessionId, keyType: type, keyId } },
          update: { keyData: keyData as object },
          create: { sessionId, keyType: type, keyId, keyData: keyData as object }
        })
      )
    )
  }

  // Load creds dari DB atau init baru
  const credsRow = await prisma.authKey.findFirst({
    where: { sessionId, keyType: 'creds', keyId: 'main' }
  })

  const { initAuthCreds, BufferJSON } = await import('@whiskeysockets/baileys')
  const creds = credsRow
    ? JSON.parse(JSON.stringify(credsRow.keyData), BufferJSON.reviver)
    : initAuthCreds()

  return {
    state: {
      creds,
      keys: {
        get: readData,
        set: writeData
      } as SignalDataTypeMap
    },
    saveCreds: async () => {
      await writeData('creds', { main: creds })
    }
  }
}
```

### 6.2 Socket Factory (Noweb + Memory Optimization)

```typescript
// src/sessions/socketFactory.ts
import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore
} from '@whiskeysockets/baileys'
import NodeCache from 'node-cache'

export async function createSocket(sessionId: string, authState: AuthenticationState) {
  const { version } = await fetchLatestBaileysVersion()

  // Cache dengan TTL ketat: hindari memory bloat
  const signalCache = new NodeCache({
    stdTTL: 300,     // 5 menit
    maxKeys: 100,    // max 100 keys per sesi
    useClones: false
  })

  const sock = makeWASocket({
    version,
    auth: {
      creds: authState.creds,
      keys: makeCacheableSignalKeyStore(authState.keys, signalCache)
    },
    // KRITIS: matikan history sync untuk mencegah memory bloat
    shouldSyncHistoryMessage: () => false,
    // Noweb: tidak perlu browser info, tapi perlu untuk koneksi
    browser: ['WhatsApp-API', 'Chrome', '3.0.0'],
    markOnlineOnConnect: false,  // hemat resource
    generateHighQualityLinkPreview: false,
    logger: pinoLogger.child({ sessionId })
  })

  return sock
}
```

### 6.3 Session Manager (In-Memory Map)

```typescript
// src/sessions/sessionManager.ts
import { WASocket } from '@whiskeysockets/baileys'

interface SessionEntry {
  socket: WASocket
  status: 'pending' | 'connected' | 'disconnected'
  phoneNumber?: string
}

// Core: Map in-memory untuk routing cepat
const sessions = new Map<string, SessionEntry>()

export const SessionManager = {
  set: (id: string, entry: SessionEntry) => sessions.set(id, entry),
  get: (id: string) => sessions.get(id),
  delete: (id: string) => {
    const entry = sessions.get(id)
    if (entry) {
      entry.socket.end(undefined)
      sessions.delete(id)
    }
  },
  has: (id: string) => sessions.has(id),
  getAll: () => Array.from(sessions.entries()).map(([id, s]) => ({
    id,
    status: s.status,
    phoneNumber: s.phoneNumber
  }))
}
```

### 6.4 Security Middleware

```typescript
// src/middleware/apiKeyAuth.ts
import { Request, Response, NextFunction } from 'express'
import crypto from 'crypto'

const VALID_API_KEY = process.env.API_KEY!

export function apiKeyAuth(req: Request, res: Response, next: NextFunction) {
  const key = req.headers['x-api-key']
  if (!key || !crypto.timingSafeEqual(
    Buffer.from(String(key)),
    Buffer.from(VALID_API_KEY)
  )) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  next()
}
```

```typescript
// src/middleware/ipWhitelist.ts
import { Request, Response, NextFunction } from 'express'

const ALLOWED_IPS = process.env.ALLOWED_IPS?.split(',').map(ip => ip.trim()) ?? []

export function ipWhitelist(req: Request, res: Response, next: NextFunction) {
  const clientIp = req.ip ?? req.socket.remoteAddress ?? ''
  const normalized = clientIp.replace('::ffff:', '')  // handle IPv4-mapped IPv6

  if (ALLOWED_IPS.length > 0 && !ALLOWED_IPS.includes(normalized)) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  next()
}
```

### 6.5 Webhook Dispatcher

```typescript
// src/webhook/dispatcher.ts
import axios from 'axios'
import axiosRetry from 'axios-retry'
import { createHmacSignature } from './signer'

const client = axios.create({ timeout: 10_000 })

axiosRetry(client, {
  retries: 5,
  retryDelay: axiosRetry.exponentialDelay,  // 1s, 2s, 4s, 8s, 16s
  retryCondition: (error) =>
    axiosRetry.isNetworkError(error) ||
    (error.response?.status !== undefined && error.response.status >= 500)
})

export async function dispatchWebhook(event: string, payload: object) {
  const webhookUrl = process.env.WEBHOOK_URL
  if (!webhookUrl) return

  const body = JSON.stringify({ event, data: payload, timestamp: Date.now() })
  const signature = createHmacSignature(body, process.env.WEBHOOK_SECRET!)

  try {
    await client.post(webhookUrl, body, {
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature': `sha256=${signature}`
      }
    })
  } catch (err) {
    // Log tapi jangan crash proses utama
    console.error('[Webhook] Failed after retries:', err)
  }
}
```

---

## 7. REST API Endpoints

### Sessions
```
POST   /api/sessions/start
Body:  { "sessionId": "string" }
Res:   { "qr": "data:image/png;base64,..." }  — atau  { "status": "already_connected" }

POST   /api/sessions/stop
Body:  { "sessionId": "string" }
Res:   { "success": true }

GET    /api/sessions/:sessionId/status
Res:   { "sessionId": "...", "status": "connected", "phoneNumber": "628xxx" }

GET    /api/sessions
Res:   [{ "sessionId": "...", "status": "...", "phoneNumber": "..." }]
```

### Messages
```
POST   /api/messages/send
Body:  { "sessionId": "...", "to": "628xxx@s.whatsapp.net", "text": "..." }
Res:   { "messageId": "...", "status": "sent" }

POST   /api/messages/send-media
Body:  { "sessionId": "...", "to": "...", "type": "image|document|audio",
         "url": "https://...", "caption": "...", "filename": "..." }
Res:   { "messageId": "...", "status": "sent" }
```

### Dashboard & Docs (No Auth Required)
```
GET    /dashboard          → Minimal web dashboard (HTML)
GET    /dashboard/events   → SSE stream (text/event-stream)
GET    /docs               → Swagger UI
GET    /docs/openapi.json  → Raw OpenAPI 3.0 spec
GET    /health             → { "status": "ok", "sessions": 3, "uptime": 1234 }
```

---

## 8. Webhook Events (Outbound ke Aplikasi Utama)

```json
// Pesan masuk
{
  "event": "message.received",
  "data": {
    "sessionId": "...",
    "from": "628xxx@s.whatsapp.net",
    "messageId": "...",
    "type": "text",
    "text": "Konfirmasi pesanan #12345",
    "timestamp": 1700000000
  }
}

// Status pengiriman berubah
{
  "event": "message.updated",
  "data": {
    "sessionId": "...",
    "messageId": "...",
    "status": "read"  // sent | delivered | read
  }
}

// Sesi terputus
{
  "event": "session.disconnected",
  "data": {
    "sessionId": "...",
    "reason": "loggedOut"  // loggedOut | connectionClosed | timedOut
  }
}

// QR baru (untuk polling dari frontend client)
{
  "event": "session.qr",
  "data": {
    "sessionId": "...",
    "qr": "data:image/png;base64,..."
  }
}
```

---

## 9. Environment Variables

```env
# .env.example

# Server
PORT=3000
NODE_ENV=production

# Security
API_KEY=your-very-long-random-api-key-here
ALLOWED_IPS=192.168.1.100,10.0.0.50    # IP aplikasi utama, kosongkan untuk allow all

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/whatsapp_api

# Webhook
WEBHOOK_URL=https://your-main-app.com/webhooks/whatsapp
WEBHOOK_SECRET=your-hmac-secret-key

# Memory (optional, jika ingin override)
MAX_SESSIONS=50
```

---

## 10. PM2 Config

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'whatsapp-api',
    script: './dist/index.js',
    instances: 1,          // 1 instance per server (state in-memory)
    exec_mode: 'fork',
    max_memory_restart: '1G',  // restart jika RAM > 1GB
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    merge_logs: true,
    restart_delay: 3000,
    max_restarts: 10
  }]
}
```

---

## 11. Nginx Config (Minimal)

```nginx
# nginx.conf
server {
  listen 443 ssl http2;
  server_name api.your-domain.com;

  ssl_certificate     /etc/letsencrypt/live/api.your-domain.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/api.your-domain.com/privkey.pem;

  # Rate limiting: max 20 req/s per IP
  limit_req_zone $binary_remote_addr zone=api:10m rate=20r/s;
  limit_req zone=api burst=50 nodelay;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_read_timeout 30s;
  }
}
```

---

## 12. Memory Optimization Checklist

- [x] `shouldSyncHistoryMessage: () => false` — matikan history sync
- [x] `NodeCache` dengan `stdTTL: 300` dan `maxKeys: 100` per sesi
- [x] `markOnlineOnConnect: false`
- [x] `generateHighQualityLinkPreview: false`
- [x] PM2 `max_memory_restart: '1G'`
- [x] PostgreSQL auth adapter (no file I/O)
- [x] Cleanup socket saat `sessions/stop` (hindari socket zombie)
- [x] Structured logging dengan level `warn` di production (kurangi I/O log)

---

## 13. Alur Inisialisasi Sesi (Happy Path)

```
Aplikasi Utama                    WhatsApp API              WhatsApp Server
      │                                │                           │
      │── POST /sessions/start ───────>│                           │
      │   { sessionId: "tx-001" }      │                           │
      │                                │── makeWASocket() ────────>│
      │                                │<── QR challenge ──────────│
      │<── { qr: "base64..." } ────────│                           │
      │                                │                           │
      │  [Tampilkan QR ke end-user]    │                           │
      │                                │                           │
      │  [User scan QR via HP]         │                           │
      │                                │<── Auth confirm ──────────│
      │                                │                           │
      │<── Webhook: session.connected ─│                           │
      │    { sessionId: "tx-001",      │                           │
      │      phoneNumber: "628xxx" }   │                           │
      │                                │                           │
      │── POST /messages/send ────────>│                           │
      │   { sessionId: "tx-001",       │── sendMessage() ─────────>│
      │     to: "628yyy@s.whatsapp.net"│                           │
      │     text: "Pesanan terkonfirmasi" }                        │
      │<── { messageId: "...", ────────│                           │
      │      status: "sent" }          │                           │
```

---

## 14. Web Dashboard

Dashboard adalah **single HTML file** yang di-serve langsung oleh Express dari `public/dashboard/index.html`. Tidak ada build step, tidak ada framework — murni HTML + CSS + vanilla JS.

### Fitur Dashboard
- **Session Monitor:** Tabel semua sesi aktif dengan status badge (pending/connected/disconnected) dan nomor HP terhubung. Auto-update via SSE.
- **Live Webhook Log:** Feed realtime event masuk (pesan diterima, status berubah, sesi disconnect). Menampilkan 100 event terakhir dengan timestamp dan payload JSON yang bisa di-expand.

### Implementasi SSE Event Bus

```typescript
// src/sse/eventBus.ts
import { Response } from 'express'

const clients = new Set<Response>()

export const SseEventBus = {
  // Daftarkan browser client baru
  subscribe: (res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.flushHeaders()
    clients.add(res)
    res.on('close', () => clients.delete(res))
  },

  // Broadcast ke semua browser yang sedang buka dashboard
  publish: (event: string, data: object) => {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
    clients.forEach(res => {
      try { res.write(payload) } catch { clients.delete(res) }
    })
  }
}
```

```typescript
// Di socketFactory.ts — setelah dispatchWebhook, tambahkan:
SseEventBus.publish('session.update', { sessionId, status: 'connected', phoneNumber })
SseEventBus.publish('webhook.log', { event: 'message.received', data: payload, ts: Date.now() })
```

```javascript
// public/dashboard/app.js — SSE client di browser
const es = new EventSource('/dashboard/events')

es.addEventListener('session.update', e => {
  const data = JSON.parse(e.data)
  updateSessionRow(data)  // update tabel DOM
})

es.addEventListener('webhook.log', e => {
  const data = JSON.parse(e.data)
  prependLogEntry(data)   // tambah baris di log feed
})
```

### Dashboard Route

```typescript
// src/routes/dashboard.ts
import { Router } from 'express'
import { SseEventBus } from '../sse/eventBus'
import { SessionManager } from '../sessions/sessionManager'
import path from 'path'

const router = Router()

// Serve HTML (no auth — aksesnya dibatasi lewat Nginx/network level jika perlu)
router.get('/', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public/dashboard/index.html'))
})

// SSE endpoint
router.get('/events', (req, res) => {
  SseEventBus.subscribe(res)
  // Kirim snapshot state awal saat pertama connect
  const snapshot = SessionManager.getAll()
  res.write(`event: snapshot\ndata: ${JSON.stringify(snapshot)}\n\n`)
})

export default router
```

---

## 15. Swagger / OpenAPI Docs

Docs di-generate otomatis dari JSDoc comment di file routes menggunakan `swagger-jsdoc`, lalu di-serve via `swagger-ui-express` di `/docs`.

### Setup

```typescript
// src/config/swagger.ts
import swaggerJsdoc from 'swagger-jsdoc'

export const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'WhatsApp Multi-Session API',
      version: '1.0.0',
      description: 'Noweb WhatsApp REST API powered by Baileys'
    },
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'x-api-key'
        }
      }
    },
    security: [{ ApiKeyAuth: [] }]
  },
  apis: ['./src/routes/*.ts']  // scan JSDoc dari semua route files
})
```

```typescript
// src/index.ts
import swaggerUi from 'swagger-ui-express'
import { swaggerSpec } from './config/swagger'

// Docs tidak butuh API key auth
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec))
app.get('/docs/openapi.json', (req, res) => res.json(swaggerSpec))
```

### Contoh JSDoc Annotation di Route

```typescript
// src/routes/sessions.ts

/**
 * @swagger
 * /api/sessions/start:
 *   post:
 *     summary: Inisialisasi sesi WhatsApp baru
 *     tags: [Sessions]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [sessionId]
 *             properties:
 *               sessionId:
 *                 type: string
 *                 example: "tx-customer-001"
 *     responses:
 *       200:
 *         description: QR code berhasil digenerate
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 qr:
 *                   type: string
 *                   description: QR image dalam format Base64 data URI
 *       409:
 *         description: Sesi sudah aktif
 */
router.post('/start', apiKeyAuth, ipWhitelist, async (req, res) => { ... })
```

---

## 16. Hal yang Sengaja TIDAK Diimplementasikan

| Fitur | Alasan Dihilangkan |
|---|---|
| Chat history & media storage | Tidak relevan untuk transaksional API; akan menyebabkan memory bloat |
| Group management | Di luar kebutuhan otomasi transaksional |
| Multi-device pairing (non-QR) | QR cukup untuk usecase ini |
| Horizontal scaling / Redis pub-sub | Implementasikan jika sudah butuh >100 sesi; overkill untuk MVP |
| QR scanner di dashboard | Sengaja dipisah — QR di-handle aplikasi utama, dashboard hanya monitoring |
| Auth pada dashboard | Akses dashboard dikontrol di level Nginx/network, bukan aplikasi |

---

## 17. Risiko & Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| WhatsApp protocol update | Sesi putus, Baileys perlu update | Pantau release Baileys; pin versi di `package.json` |
| Number ban oleh WhatsApp | Nomor diblokir permanen | Patuhi rate limit; jangan spam; gunakan nomor bisnis resmi |
| Memory leak di sesi lama | Server crash | PM2 `max_memory_restart` + monitoring |
| PostgreSQL down | Sesi tidak bisa restore setelah restart | DB replication / fallback; health check endpoint |
| Webhook endpoint tidak responsif | Event hilang setelah semua retry | Log failed events ke DB untuk manual replay |

---

*Context ini mencakup arsitektur lengkap, implementasi kunci, dashboard monitoring, Swagger docs, dan keputusan desain untuk proyek WhatsApp Multi-Session API berbasis Baileys noweb.*
