import getDb from './index'

export interface Session {
  session_id: string
  device_id: string
  video_id: string
  video_title: string
  conversation_type: string
  subtitle_text: string
  created_at: number
  last_accessed_at: number
}

const TTL_DAYS = parseInt(process.env.CHAT_HISTORY_SQLITE_TTL_DAYS ?? '90', 10)
const TTL_MS = TTL_DAYS * 24 * 60 * 60 * 1000

export function isExpired(session: Session): boolean {
  return Date.now() - session.last_accessed_at > TTL_MS
}

export function createSession(data: {
  session_id: string
  device_id: string
  video_id: string
  video_title: string
  conversation_type: string
  subtitle_text: string
}): void {
  const db = getDb()
  const now = Date.now()
  db.prepare(`
    INSERT INTO sessions (session_id, device_id, video_id, video_title, conversation_type, subtitle_text, created_at, last_accessed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(data.session_id, data.device_id, data.video_id, data.video_title, data.conversation_type, data.subtitle_text, now, now)
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

