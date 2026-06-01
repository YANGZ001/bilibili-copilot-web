# Tasks: Security Hardening & Code Quality

## Phase 1 — Infrastructure

- [x] Add `dompurify` and `@types/dompurify` to `package.json`
- [x] Create `lib/llm.ts` with `getLLMConfig()` helper
- [x] Create `lib/streamSSE.ts` with `readSSEChunks()` async generator
- [x] Add `subtitle_text TEXT NOT NULL DEFAULT ''` migration to `lib/db/index.ts` SCHEMA constant
- [x] Add `globalThis.__db` singleton guard to `lib/db/index.ts` to survive hot reload

## Phase 2 — Data Layer

- [x] Update `lib/db/sessions.ts`: add `subtitle_text` to `createSession` input and INSERT
- [x] Update `lib/db/sessions.ts`: add `subtitle_text` to `Session` interface
- [x] Update `lib/db/sessions.ts`: add `deleteExpiredSessions()` function (deletes sessions + cascade messages where `last_accessed_at < cutoff`)
- [x] Update `lib/db/messages.ts`: in `appendMessages`, assign `now` and `now + 1` to user vs assistant rows to avoid timestamp collision

## Phase 3 — API Layer

- [x] Update `app/api/sessions/route.ts` POST: read `subtitle_text` from body; pass to `createSession`; stop appending the system message row
- [x] Update `app/api/sessions/[id]/route.ts` GET: return `subtitle_text` in response body
- [x] Update `app/api/sessions/[id]/messages/route.ts` POST: use `getLLMConfig`, `readSSEChunks`, cap history to last 20 messages
- [x] Update `app/api/sessions/[id]/messages/route.ts` PUT: allow `messages: []` (relax non-empty validation to permit "clear")
- [x] Update `app/api/summarize/route.ts`: use `getLLMConfig`, `readSSEChunks`
- [x] Update `app/api/chat/route.ts`: use `getLLMConfig`, `readSSEChunks`
- [x] Call `deleteExpiredSessions()` on startup (in `lib/db/index.ts` `getDb()`)

## Phase 4 — Frontend

- [x] `components/SummaryViewer.tsx`: wrap `marked.parse(...)` output with `DOMPurify.sanitize(html, { ADD_ATTR: ['data-timestamp'], ... })` before passing to `dangerouslySetInnerHTML`
- [x] `components/VideoChat.tsx`: same DOMPurify sanitization for AI message rendering
- [x] `components/VideoChat.tsx`: "清空对话" calls `PUT /api/sessions/${sessionId}/messages` with `{ messages: [] }` before `setMessages([])`
- [x] `components/VideoChat.tsx`: remove `videoTitle` from `VideoChatProps` and all call sites
- [x] `hooks/useSession.ts`: read `subtitleText` from `data.subtitle_text`; delete `extractSubtitleText()` function
- [x] `hooks/useSession.ts`: fix off-by-one — guard `firstAssistantIdx === -1` explicitly
- [x] `components/HomeClient.tsx`: send `subtitle_text: resolvedSubtitleText` in `POST /api/sessions` body
- [~] `components/HomeClient.tsx`: delete local `extractBvid` — skipped: `lib/bilibili.ts` has module-level Redis init; importing it from a `'use client'` component would bundle server code into the browser

---

## Acceptance Criteria

- **XSS**: Pasting `![x](x)<img src=x onerror=alert(1)>` into a mocked LLM response renders as plain text or escaped HTML — no alert fires.
- **Clear conversation**: After clicking "清空对话", refreshing the page shows an empty chat panel.
- **Session restore**: Loading an existing session (via `?session=` URL) correctly populates the summary panel and chat history with no console errors.
- **Session restore (no assistant)**: Loading a session whose messages contain only a user turn does not crash the UI or dump all messages into the chat panel.
- **LLM history cap**: A session with 30+ chat turns still successfully calls the LLM (no 400/context-length error from DeepSeek).
- **DB cleanup**: After startup, sessions with `last_accessed_at` older than 14 days are absent from the DB.
- **No regressions**: The golden summarize → chat → retry flow works end-to-end via `docker compose up --build`.
