const sessions = new Map()
let logCount = 0
const MAX_LOG = 100

// ── SSE Connection ──────────────────────────────────────────────
const es = new EventSource('/dashboard/events')
const dot = document.getElementById('sse-dot')
const label = document.getElementById('sse-label')

es.onopen = () => {
  dot.classList.remove('off')
  label.textContent = 'Live'
}

es.onerror = () => {
  dot.classList.add('off')
  label.textContent = 'Reconnecting...'
}

es.addEventListener('snapshot', e => {
  const list = JSON.parse(e.data)
  sessions.clear()
  list.forEach(s => sessions.set(s.id, s))
  renderSessions()
  updateStats()
})

es.addEventListener('session.update', e => {
  const data = JSON.parse(e.data)
  const existing = sessions.get(data.sessionId) || {}
  sessions.set(data.sessionId, { ...existing, id: data.sessionId, ...data })
  renderSessions()
  updateStats()
})

es.addEventListener('session.qr', e => {
  const data = JSON.parse(e.data)
  const existing = sessions.get(data.sessionId) || { id: data.sessionId, status: 'pending' }
  sessions.set(data.sessionId, { ...existing, qr: data.qr })
  renderSessions()
})

es.addEventListener('webhook.log', e => {
  appendLog(JSON.parse(e.data))
})

// ── Render Sessions ─────────────────────────────────────────────
function renderSessions() {
  const tbody = document.getElementById('sessions-tbody')
  if (sessions.size === 0) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state">Belum ada sesi. <a href="/dashboard/scan" style="color:#58a6ff">Tambah sesi baru →</a></div></td></tr>`
    return
  }

  tbody.innerHTML = Array.from(sessions.values()).map(s => {
    const nameHtml = s.name
      ? `<span class="session-name-text" onclick="editName('${escHtml(s.id)}')">${escHtml(s.name)}</span>`
      : `<span class="session-name-empty" onclick="editName('${escHtml(s.id)}')">+ beri nama</span>`

    const phone = s.phoneNumber
      ? `<span style="font-family:monospace">+${escHtml(String(s.phoneNumber))}</span>`
      : `<span style="color:#8b949e">—</span>`

    return `
      <tr id="row-${escHtml(s.id)}">
        <td id="name-cell-${escHtml(s.id)}">${nameHtml}</td>
        <td><code class="session-id">${escHtml(s.id)}</code></td>
        <td><span class="badge-status badge-${s.status || 'pending'}">${s.status || 'pending'}</span></td>
        <td>${phone}</td>
        <td>
          <div class="action-group">
            <button class="btn btn-warning" onclick="restartSession('${escHtml(s.id)}')">Restart</button>
            <button class="btn btn-danger" onclick="stopSession('${escHtml(s.id)}')">Stop</button>
          </div>
        </td>
      </tr>`
  }).join('')
}

function updateStats() {
  document.getElementById('stat-total').textContent = sessions.size
  const connected = Array.from(sessions.values()).filter(s => s.status === 'connected').length
  document.getElementById('stat-connected').textContent = connected
}

// ── Edit Name (inline) ──────────────────────────────────────────
function editName(sessionId) {
  const cell = document.getElementById(`name-cell-${sessionId}`)
  if (!cell) return

  const current = sessions.get(sessionId)?.name || ''
  cell.innerHTML = `<input class="name-input" id="name-input-${escHtml(sessionId)}" value="${escHtml(current)}" placeholder="Nama lembaga..." maxlength="60">`
  const input = document.getElementById(`name-input-${sessionId}`)
  input.focus()
  input.select()

  const save = async () => {
    const newName = input.value.trim()
    await saveName(sessionId, newName)
  }

  input.addEventListener('blur', save)
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') save()
    if (e.key === 'Escape') renderSessions()
  })
}

async function saveName(sessionId, name) {
  try {
    await fetch(`/dashboard/api/sessions/${encodeURIComponent(sessionId)}/name`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    })
    // SSE will push the update
  } catch (err) {
    console.error('Failed to save name', err)
    renderSessions()
  }
}

// ── Stop Session ────────────────────────────────────────────────
async function stopSession(sessionId) {
  if (!confirm(`Stop sesi "${sessionId}"?`)) return
  try {
    const resp = await fetch(`/dashboard/api/sessions/${encodeURIComponent(sessionId)}/stop`, {
      method: 'POST'
    })
    if (resp.ok) {
      sessions.delete(sessionId)
      renderSessions()
      updateStats()
    } else {
      const d = await resp.json()
      alert('Gagal: ' + (d.error || resp.status))
    }
  } catch (err) {
    alert('Gagal menghentikan sesi: ' + err.message)
  }
}

// ── Restart Session ─────────────────────────────────────────────
async function restartSession(sessionId) {
  if (!confirm(`Restart sesi "${sessionId}"?\n\nSesi akan reconnect otomatis menggunakan kredensial yang sudah tersimpan.`)) return
  try {
    const resp = await fetch(`/dashboard/api/sessions/${encodeURIComponent(sessionId)}/restart`, {
      method: 'POST'
    })
    if (!resp.ok) {
      const d = await resp.json()
      alert('Gagal restart: ' + (d.error || resp.status))
    }
    // SSE will push status update automatically
  } catch (err) {
    alert('Gagal restart sesi: ' + err.message)
  }
}

// ── Webhook Log ─────────────────────────────────────────────────
function appendLog(entry) {
  const feed = document.getElementById('log-feed')
  const empty = feed.querySelector('.empty-state')
  if (empty) empty.remove()

  logCount++
  const time = new Date(entry.ts || Date.now()).toLocaleTimeString('id-ID')
  const payloadStr = JSON.stringify(entry.data, null, 2)

  const div = document.createElement('div')
  div.className = 'log-entry'
  div.innerHTML = `
    <div class="log-meta">
      <span class="log-event">${escHtml(entry.event)}</span>
      <span class="log-time">${time}</span>
    </div>
    <div class="log-payload collapsed" onclick="this.classList.toggle('collapsed')">${escHtml(payloadStr)}</div>
  `
  feed.insertBefore(div, feed.firstChild)
  while (feed.children.length > MAX_LOG) feed.removeChild(feed.lastChild)
}

function clearLog() {
  document.getElementById('log-feed').innerHTML = '<div class="empty-state">Log dibersihkan.</div>'
  logCount = 0
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
