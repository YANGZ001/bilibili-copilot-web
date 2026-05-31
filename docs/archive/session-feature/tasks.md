# Session Feature — Tasks

## Phase 1: Infrastructure (Storage Layer)

- [x] Install dependencies: `better-sqlite3` and its TypeScript types (`@types/better-sqlite3`)
- [x] Create `lib/db/schema.sql`: define `sessions` and `messages` tables
- [x] Create `lib/db/index.ts`: SQLite connection singleton; auto-runs schema init on startup
- [x] Create `lib/db/sessions.ts`: CRUD operations
  - `createSession(data)`
  - `getSession(session_id)`
  - `updateLastAccessed(session_id)`
  - `listSessionsByDevice(device_id)`
  - `isExpired(session)`
- [x] Create `lib/db/messages.ts`: CRUD operations
  - `appendMessage(session_id, role, content)`
  - `appendMessages(session_id, messages[])` — batch insert
  - `getMessages(session_id)`
- [x] Update `docker-compose.yml`: mount `./data:/data` volume
- [x] Update `Dockerfile`:
  - runner stage explicitly creates `/data`: `RUN mkdir -p /data`
  - `node_modules` copied in full from builder — native `.node` file preserved

---

## Phase 2: API Layer

- [x] `POST /api/sessions`
  - Accept `device_id`, `video_id`, `video_title`, `conversation_type`, `messages[]`
  - Generate UUID, write to `sessions`, batch-insert messages
  - Return `{ session_id }`
- [x] `GET /api/sessions/[id]`
  - Query session + all messages
  - Return 404 if not found; 410 if expired
  - Update `last_accessed_at` on success
- [x] `POST /api/sessions/[id]/messages`
  - Accept user message
  - Load full message history from DB, call LLM (streaming)
  - After stream ends, write both user + assistant messages to DB
  - Return streaming response
- [x] `GET /api/sessions?device_id=xxx`
  - Return all non-expired sessions for the device, ordered by `last_accessed_at` DESC

---

## Phase 3: Frontend Integration

- [x] Create `lib/device.ts`: `getOrCreateDeviceId()` utility
- [x] Create `hooks/useSession.ts`:
  - Read `?session=` param from URL via `useSearchParams`
  - If present, call `GET /api/sessions/[id]` to load data
  - Extracts: `summary` (first assistant msg), `chatMessages` (subsequent pairs), `subtitleText` (from system msg)
  - If absent, return empty session state (show form)
- [x] Update `app/page.tsx`: converted to server component wrapper with `<Suspense>`
- [x] Create `components/HomeClient.tsx`:
  - All former `page.tsx` client logic
  - Uses `useSession` hook + `activeContext` state
  - On form submit: stream → create session → `router.push('/?session=uuid')`
  - Session restore: `useEffect` syncs session data into `activeContext`
  - Expired state: friendly message + "New Conversation" button
- [x] Update `VideoChat` component:
  - Props: `sessionId`, `initialMessages` (removed `subtitleText`)
  - Follow-up calls → `POST /api/sessions/[id]/messages`
  - Streaming + local state rendering unchanged
- [x] Add "New Conversation" button in video title banner
- [x] Handle 410 expired state: user-friendly message + New Conversation button
- [x] `lib/prompts.ts`: added `buildChatSystemPrompt()` export (DRY with `/api/chat`)

---

## Phase 4: History List

- [x] Create `components/SessionHistory.tsx`; display format: `date · type · video title`
- [x] Wire up `GET /api/sessions?device_id=xxx`
- [x] Clicking a history item navigates to its session URL
- [x] Rendered in `HomeClient` on the home page when no active session

---

## Acceptance Criteria

- [x] After submission, URL becomes `/?session=uuid`; refreshing fully restores the conversation
- [x] On session restore, user can continue asking follow-ups and LLM understands video context
- [x] Clicking "New Conversation" returns to `/` with a reset form
- [x] Accessing an expired session URL shows a friendly expiry message
- [x] `.db` file persists across Docker restarts
