# Retry / Regenerate Summary — Tasks

## Phase 1: DB Layer

- [x] Add `replaceMessages(session_id, messages)` to `lib/db/messages.ts`
  - Transaction: DELETE all messages for session, then bulk INSERT new ones

## Phase 2: API Layer

- [x] Add `PUT` handler to `app/api/sessions/[id]/messages/route.ts`
  - Validate session exists and is not expired
  - Call `replaceMessages`, then `updateLastAccessed`
  - Return `{ ok: true }`

## Phase 3: Frontend Integration

- [x] Extend `ActiveContext` with `conversationType: string`
- [x] Set `conversationType` in both the generate path and the session-restore path
- [x] Add `handleRetry` to `HomeClient`
- [x] Add "重新生成" button to the video title banner

## Acceptance Criteria

- [x] Clicking "重新生成" streams a new summary into the left panel without changing the URL
- [x] The chat panel is empty after retry completes
- [x] Refreshing the page after retry shows the new summary (persisted in DB) — ✅ API verified 2026-05-31
- [x] If retry fails mid-stream, the original summary is restored in the UI
- [x] The button is disabled while any loading is in progress
- [x] `PUT /api/sessions/:id/messages` returns 200/400/404/410 correctly — ✅ API verified 2026-05-31
- [x] `replaceMessages` deletes all prior messages including chat history (5→3 confirmed) — ✅ 2026-05-31
