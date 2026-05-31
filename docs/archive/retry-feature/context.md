# Retry Feature — Implementation Context

## Current Status

**Phase 1 (DB Layer)**: ✅ Complete
**Phase 2 (API Layer)**: ✅ Complete
**Phase 3 (Frontend)**: ✅ Complete
**Verification**: ✅ Complete (2026-05-31)
**Status**: ✅ DONE — archived

`docker compose up --build` clean. TypeScript clean. All acceptance criteria met.

---

## Key Decisions (2026-05-31)

### In-place session update, not a new session
Retry replaces messages within the existing session. The URL (`?session=<uuid>`) stays the same. Rationale: user explicitly asked for "same session id".

### Chat messages (4+) are deleted on retry
Follow-up Q&A is based on the old summary. Once the summary changes, those messages become stale context. User confirmed: clear them.

### Subtitle cache not bypassed on retry
The issue is AI output quality, not stale subtitle data. `bypassCache: false` is hardcoded in `handleRetry`. If the user suspects bad subtitles they can start a new conversation with the "强制刷新" checkbox.

### Client-side orchestration (not a server-side /regenerate endpoint)
`handleRetry` reuses the existing `/api/summarize` streaming endpoint unchanged. After the stream completes, it calls `PUT /api/sessions/[id]/messages` to persist. This keeps the server-side surface minimal and the streaming UX consistent with initial generation.

### Error recovery saves `oldSummary` before clearing
`handleRetry` captures `activeContext.summary` at the start. On any error, the original summary is restored so the user doesn't lose their output.

### `conversationType` added to `ActiveContext`
Needed so `handleRetry` knows which template was used — both when the session was just generated (reads from `templateId` state) and when it was restored from DB (reads from `session.conversation_type`).

---

## Open Questions

None at this time.

---

## Files Modified

- `lib/db/messages.ts` — added `replaceMessages()`
- `app/api/sessions/[id]/messages/route.ts` — added `PUT` handler
- `components/HomeClient.tsx` — `conversationType` field, `handleRetry`, retry button
