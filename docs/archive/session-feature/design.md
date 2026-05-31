# Session Feature — Technical Design

## Data Model

### `sessions` table

| Field | Type | Description |
|---|---|---|
| `session_id` | TEXT (UUID) | Primary key; appears in the URL |
| `device_id` | TEXT (UUID) | From client `localStorage`; identifies the browser |
| `video_id` | TEXT | Bilibili video ID, e.g. `BV1VMR4BNEYq` |
| `video_title` | TEXT | Video title; shown in the history list |
| `conversation_type` | TEXT | Enum: `summarize` / `chat` / … |
| `created_at` | INTEGER | Unix timestamp (ms) |
| `last_accessed_at` | INTEGER | Unix timestamp (ms); used for TTL check |

### `messages` table

| Field | Type | Description |
|---|---|---|
| `id` | INTEGER | Auto-increment primary key |
| `session_id` | TEXT | Foreign key → `sessions.session_id` |
| `role` | TEXT | `"system"` / `"user"` / `"assistant"` |
| `content` | TEXT | Message content (Markdown or plain text) |
| `created_at` | INTEGER | Unix timestamp (ms) |

> **On `system` messages**: When a session is first submitted, the full prompt (including the video transcript) is stored as `role: "system"`. On session restore, all messages are loaded ordered by `created_at` and passed directly to the LLM — preserving full context with no extra work.

---

## Session Lifecycle

```
User visits /
    │
    ├─ URL has ?session=uuid ──→ Load session from DB ──→ Render conversation history
    │
    └─ No URL param ──────────→ Show empty input form
                                      │
                                User fills in and submits
                                      │
                                POST /api/sessions
                                      │
                                Server generates UUID, writes to DB
                                      │
                                Returns session_id
                                      │
                                Client navigates to /?session=uuid
```

### Expiry Handling

- Update `last_accessed_at` on every successful session access
- Server: if `now - last_accessed_at > 14 days`, return `410 Gone`
- Client: on 410, show "This conversation has expired" message with a "New Conversation" button

---

## API Design

### `POST /api/sessions`
Create a new session (called on first form submission)

**Request body**
```json
{
  "device_id": "uuid-from-localstorage",
  "video_id": "BV1VMR4BNEYq",
  "video_title": "Video title",
  "conversation_type": "summarize",
  "initial_message": {
    "role": "system",
    "content": "You are … (full prompt including transcript)"
  }
}
```

**Response**
```json
{
  "session_id": "uuid-xxx"
}
```

---

### `GET /api/sessions/:session_id`
Load session metadata + all messages

**Response**
```json
{
  "session_id": "uuid-xxx",
  "video_id": "BV1VMR4BNEYq",
  "video_title": "Video title",
  "conversation_type": "summarize",
  "created_at": 1748700000000,
  "messages": [
    { "role": "system", "content": "..." },
    { "role": "user", "content": "Summarize this video" },
    { "role": "assistant", "content": "## Summary\n..." }
  ]
}
```

---

### `POST /api/sessions/:session_id/messages`
Append a follow-up turn (called when user asks a follow-up question)

**Request body**
```json
{
  "role": "user",
  "content": "Can you elaborate on point 3?"
}
```

**Response**: Streaming assistant reply (SSE / ReadableStream). After the stream ends, both the user and assistant messages are written to DB.

---

### `GET /api/sessions?device_id=xxx`
List history sessions for a device (used by the history panel)

**Response**
```json
[
  {
    "session_id": "uuid-xxx",
    "video_title": "Vue 3 Core Internals",
    "conversation_type": "summarize",
    "created_at": 1748700000000,
    "last_accessed_at": 1748800000000
  }
]
```

---

## Frontend State Design

```
URL /?session=uuid  →  useSession(session_id) hook
                              │
                    session is null  →  Show input form
                              │
                    session has data  →  Show conversation UI
                                            ├── video_id / title (read-only)
                                            ├── Message history list
                                            └── Follow-up input box
```

### device_id Management

```typescript
// lib/device.ts
export function getOrCreateDeviceId(): string {
  const key = 'bilibili_copilot_device_id'
  let id = localStorage.getItem(key)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(key, id)
  }
  return id
}
```

---

## Storage

- **Engine**: SQLite (`better-sqlite3`)
- **File path**: `/data/chat.db` (mounted via Docker volume)
- **Migration**: Hand-written SQL init script (`lib/db/schema.sql`); executed automatically on startup

### Docker volume config

```yaml
# Add to docker-compose.yml
volumes:
  - ./data:/data
```

---

## Directory Structure (new additions)

```
lib/
  db/
    index.ts          # SQLite connection singleton
    schema.sql        # CREATE TABLE statements
    sessions.ts       # session CRUD
    messages.ts       # messages CRUD
  device.ts           # getOrCreateDeviceId() utility

hooks/
  useSession.ts       # Reads ?session= from URL and loads session data

app/api/
  sessions/
    route.ts          # GET /api/sessions?device_id=xxx (history list)
                      # POST /api/sessions (create new session)
                      # Note: Next.js App Router uses named exports
                      # (export async function GET / POST) in the same route.ts
    [id]/
      route.ts        # GET /api/sessions/[id] (load session + messages)
      messages/
        route.ts      # POST /api/sessions/[id]/messages (follow-up, streaming)
```
