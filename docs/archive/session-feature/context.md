# Session Feature — Implementation Context

Use this file to resume work after any interruption. It tracks current state, key decisions, and "resume here" notes.

---

## Current Status

**Phase 1 (Infrastructure)**: ✅ Complete
**Phase 2 (API Layer)**: ✅ Complete
**Phase 3 (Frontend)**: ✅ Complete
**Phase 4 (History List)**: ✅ Complete
**All acceptance criteria**: ✅ Verified (2026-05-31)

Build passes (`npm run build` clean). TypeScript clean. Docker build verified working.

## Docker Bugs Fixed During Deployment

1. **`python3 make g++` missing** — added `RUN apk add --no-cache python3 make g++` to builder stage (needed by `better-sqlite3` / node-gyp)
2. **glibc vs musl binary mismatch** — created `.dockerignore` excluding `node_modules` (host's glibc build was overwriting Alpine build)
3. **`schema.sql` not in runner stage** — inlined SQL schema as `const SCHEMA` in `lib/db/index.ts`, removed `fs.readFileSync`
4. **Wrong DB path** — added `DB_PATH=/data/chat.db` to `docker-compose.yml` environment (overrides `./data/chat.db` from `.env.local`)
5. **`crypto.randomUUID` unavailable over HTTP** — added `Math.random()` fallback in `lib/device.ts` (Web Crypto API restricted to secure contexts)

---

## Key Implementation Decisions

### Session creation timing
Sessions are created AFTER the `/api/summarize` stream completes (not before). This avoids a double-LLM-call and ensures all 3 initial messages (system + user prompt + summary) are saved at once.

### Initial messages stored per session
1. `role: "system"` — chat system prompt (with full subtitle text embedded)
2. `role: "user"` — the template instruction (what the LLM was asked to generate)
3. `role: "assistant"` — the summary response

On session restore, the first assistant message IS the summary shown in SummaryViewer. Subsequent user/assistant pairs are the Q&A chat history.

### `subtitleText` extraction on restore
The system message content wraps subtitles between:
```
--- 视频字幕上下文开始 ---
{subtitleText}
--- 视频字幕上下文结束 ---
```
The `useSession` hook parses this delimiter to extract `subtitleText`.

### Chat system prompt shared utility
`buildChatSystemPrompt(subtitleText, videoTitle)` exported from `lib/prompts.ts`. Used by both:
- Client (HomeClient.tsx) — to build the system message for session creation
- Server (app/api/chat/route.ts) — existing chat route (legacy, kept unchanged)
- Server (app/api/sessions/[id]/messages/route.ts) — NOT needed here; messages are stored as-is and passed directly to LLM

### `page.tsx` refactor
`app/page.tsx` becomes a server component wrapper around `<Suspense>`. All client logic moves to `components/HomeClient.tsx`. Required because `useSearchParams()` (used in `hooks/useSession.ts`) needs a Suspense boundary.

### `VideoChat` props change
- `subtitleText` prop REMOVED (server handles context via DB)
- `sessionId: string` prop ADDED
- `initialMessages?: Message[]` prop ADDED (populated on session restore)
- Follow-up fetch changes from `/api/chat` to `/api/sessions/[id]/messages`

### `/api/chat` kept as-is
Not deleted — still functional as a legacy route. Not called by the updated VideoChat.

---

## Files Created / Modified

### Phase 1
- [x] `lib/db/schema.sql`
- [x] `lib/db/index.ts`
- [x] `lib/db/sessions.ts`
- [x] `lib/db/messages.ts`
- [x] `docker-compose.yml` (add volume)
- [x] `Dockerfile` (add /data mkdir)
- [x] `package.json` (better-sqlite3 installed)

### Phase 2
- [x] `app/api/sessions/route.ts`
- [x] `app/api/sessions/[id]/route.ts`
- [x] `app/api/sessions/[id]/messages/route.ts`

### Phase 3
- [x] `lib/device.ts`
- [x] `lib/prompts.ts` (add buildChatSystemPrompt export)
- [x] `hooks/useSession.ts`
- [x] `app/page.tsx` (server component wrapper)
- [x] `components/HomeClient.tsx` (new — all page.tsx client logic + session integration)
- [x] `components/VideoChat.tsx` (update props + API target)

### Phase 4
- [x] `components/SessionHistory.tsx` (new — history list component)
- [x] `components/HomeClient.tsx` (render SessionHistory on home page)
