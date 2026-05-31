import getDb from './index'

export interface Session {
  session_id: string
  device_id: string
  video_id: string
  video_title: string
  conversation_type: string
  created_at: number
  last_accessed_at: number
}

const TTL_MS = 14 * 24 * 60 * 60 * 1000 // 14 days

export function isExpired(session: Session): boolean {
  return Date.now() - session.last_accessed_at > TTL_MS
}

export function createSession(data: {
  session_id: string
  device_id: string
  video_id: string
  video_title: string
  conversation_type: string
}): void {
  const db = getDb()
  const now = Date.now()
  db.prepare(`
    INSERT INTO sessions (session_id, device_id, video_id, video_title, conversation_type, created_at, last_accessed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(data.session_id, data.device_id, data.video_id, data.video_title, data.conversation_type, now, now)
}

export function getSession(session_id: string): Session | undefined {
  const db = getDb()
  return db.prepare('SELECT * FROM sessions WHERE session_id = ?').get(session_id) as Session | undefined
}

export function updateLastAccessed(session_id: string): void {
  const db = getDb()
  db.prepare('UPDATE sessions SET last_accessed_at = ? WHERE session_id = ?').run(Date.now(), session_id)
}

export function listSessionsByDevice(device_id: string): Session[] {
  const db = getDb()
  const cutoff = Date.now() - TTL_MS
  return db.prepare(`
    SELECT * FROM sessions
    WHERE device_id = ? AND last_accessed_at > ?
    ORDER BY last_accessed_at DESC
  `).all(device_id, cutoff) as Session[]
}
