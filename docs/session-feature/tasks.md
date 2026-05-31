# Session Feature — Tasks

## Phase 1: Infrastructure (Storage Layer)

- [ ] Install dependencies: `better-sqlite3` and its TypeScript types (`@types/better-sqlite3`)
- [ ] Create `lib/db/schema.sql`: define `sessions` and `messages` tables
- [ ] Create `lib/db/index.ts`: SQLite connection singleton; auto-runs schema init on startup
- [ ] Create `lib/db/sessions.ts`: CRUD operations
  - `createSession(data)`
  - `getSession(session_id)`
  - `updateLastAccessed(session_id)`
  - `listSessionsByDevice(device_id)`
  - `isExpired(session)`
- [ ] Create `lib/db/messages.ts`: CRUD operations
  - `appendMessage(session_id, role, content)`
  - `getMessages(session_id)`
- [ ] Update `docker-compose.yml`: mount `./data:/data` volume
- [ ] Update `Dockerfile`:
  - runner stage must explicitly create `/data`: `RUN mkdir -p /data`
  - `better-sqlite3` is a native addon compiled in the builder stage. Copy `node_modules` in full to the runner stage — do NOT copy only production deps, or the native `.node` file will be missing

---

## Phase 2: API Layer

- [ ] `POST /api/sessions`
  - Accept `device_id`, `video_id`, `video_title`, `conversation_type`, `initial_message`
  - Generate UUID, write to `sessions` and insert first `system` message
  - Return `{ session_id }`
- [ ] `GET /api/sessions/[id]`
  - Query session + all messages
  - Return 404 if not found; 410 if expired
  - Update `last_accessed_at` on success
- [ ] `POST /api/sessions/[id]/messages`
  - Accept user message
  - Load full message history from DB, call LLM (streaming)
  - After stream ends, write both user + assistant messages to DB
  - Return streaming response
- [ ] `GET /api/sessions?device_id=xxx`
  - Return all non-expired sessions for the device, ordered by `last_accessed_at` DESC

---

## Phase 3: Frontend Integration

- [ ] Create `lib/device.ts`: `getOrCreateDeviceId()` utility
- [ ] Create `hooks/useSession.ts`:
  - Read `?session=` param from URL
  - If present, call `GET /api/sessions/[id]` to load data
  - If absent, return empty session state (show form)
- [ ] Update `app/page.tsx`:
  - Wire up `useSession` hook
  - Render form or conversation UI based on session state
  - On form submit, call `POST /api/sessions`, then navigate to `/?session=uuid` (`router.push`)
- [ ] Update `VideoChat` component:
  - messages are no longer managed locally; receive them via props (initialized from `useSession`)
  - Follow-up calls go to `POST /api/sessions/[id]/messages` instead of existing `/api/chat`
  - Support streaming assistant reply rendering
  - **Important**: `subtitleText` is currently passed as a prop. For new sessions it comes from `page.tsx` state; for restored sessions it must be extracted from the first `role: "system"` message's `content` (which contains the transcript). Encapsulate this extraction in the `useSession` hook and expose it as a `subtitleText` field.
- [ ] Add "New Conversation" button: navigate to `/` (`router.push('/')`)
- [ ] Handle 410 expired state: show user-friendly message + New Conversation button

---

## Phase 4: History List (deferrable)

- [ ] Create a history sidebar / dropdown component; display format: `date · type · video title`
- [ ] Wire up `GET /api/sessions?device_id=xxx`
- [ ] Clicking a history item navigates to its session URL

---

## Acceptance Criteria

- [ ] After submission, URL becomes `/?session=uuid`; refreshing fully restores the conversation
- [ ] On session restore, user can continue asking follow-ups and LLM understands video context
- [ ] Clicking "New Conversation" returns to `/` with a reset form
- [ ] Accessing an expired session URL shows a friendly expiry message
- [ ] `.db` file persists across Docker restarts
