import getDb from './index'

export interface Message {
  id: number
  session_id: string
  role: string
  content: string
  created_at: number
}

export function appendMessage(session_id: string, role: string, content: string): void {
  const db = getDb()
  db.prepare('INSERT INTO messages (session_id, role, content, created_at) VALUES (?, ?, ?, ?)').run(
    session_id, role, content, Date.now()
  )
}

export function appendMessages(session_id: string, messages: Array<{ role: string; content: string }>): void {
  const db = getDb()
  const insert = db.prepare('INSERT INTO messages (session_id, role, content, created_at) VALUES (?, ?, ?, ?)')
  const insertMany = db.transaction((msgs: Array<{ role: string; content: string }>) => {
    const now = Date.now()
    for (const msg of msgs) {
      insert.run(session_id, msg.role, msg.content, now)
    }
  })
  insertMany(messages)
}

export function getMessages(session_id: string): Message[] {
  const db = getDb()
  return db.prepare('SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC, id ASC').all(session_id) as Message[]
}
