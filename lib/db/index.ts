import Database from 'better-sqlite3'

const DB_PATH = process.env.DB_PATH || '/data/chat.db'

const SCHEMA = `
CREATE TABLE IF NOT EXISTS sessions (
  session_id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL,
  video_id TEXT NOT NULL,
  video_title TEXT NOT NULL,
  conversation_type TEXT NOT NULL DEFAULT 'summarize',
  created_at INTEGER NOT NULL,
  last_accessed_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(session_id)
);

CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_sessions_device ON sessions(device_id, last_accessed_at);
`

// Additive migrations applied after initial schema creation.
// Each statement must be idempotent (ALTER TABLE ADD COLUMN is safe to re-run only
// on SQLite ≥ 3.37; we guard with a try/catch for older versions that lack IF NOT EXISTS).
const MIGRATIONS = [
  `ALTER TABLE sessions ADD COLUMN subtitle_text TEXT NOT NULL DEFAULT ''`,
]

const g = globalThis as typeof globalThis & { __db?: Database.Database }

function getDb(): Database.Database {
  if (!g.__db) {
    g.__db = new Database(DB_PATH)
    g.__db.pragma('journal_mode = WAL')
    g.__db.pragma('foreign_keys = ON')
    g.__db.exec(SCHEMA)
    for (const migration of MIGRATIONS) {
      try {
        g.__db.exec(migration)
      } catch {
        // column already exists — safe to ignore
      }
    }
  }
  return g.__db
}

export default getDb
