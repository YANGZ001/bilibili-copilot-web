# Design: Security Hardening & Code Quality

## Data Model

### Schema migration — add `subtitle_text` to `sessions`

```sql
ALTER TABLE sessions ADD COLUMN subtitle_text TEXT NOT NULL DEFAULT '';
```

Existing rows get `''`; new sessions populate it from the subtitle fetch result.

**Why**: `subtitle_text` is currently stored by embedding it inside the system-prompt message row and then scraped back out with fragile delimiter parsing in `useSession.ts`. Storing it as a first-class column eliminates the coupling between `buildChatSystemPrompt` formatting and session restore logic.

| Column | Type | Description |
|---|---|---|
| subtitle_text | TEXT NOT NULL DEFAULT '' | Raw subtitle text for the session's video |

No other schema changes. The `messages` table is unchanged; the `system` role row is removed from inserts (see API changes).

---

## Core Flow

### XSS fix

```
LLM response text
  → preprocessText()          (injects custom HTML for timestamps/images)
  → marked.parse()            (markdown → HTML)
  → DOMPurify.sanitize()      (strips script/event-handler injections)  ← NEW
  → dangerouslySetInnerHTML
```

`DOMPurify` is configured to allow the specific attributes used by the timestamp/image feature:

```ts
DOMPurify.sanitize(html, {
  ADD_ATTR: ['data-timestamp'],
  ALLOWED_TAGS: [...DOMPurify.defaults.ALLOWED_TAGS, 'button', 'div', 'span', 'svg', 'path', 'rect', 'circle'],
})
```

---

### Subtitle text as first-class field

**Session creation flow (new)**:
1. `/api/summarize` returns `subtitleText` in the metadata header (unchanged).
2. `HomeClient` sends `subtitle_text` in the `POST /api/sessions` body (new field).
3. `createSession` stores it in the `subtitle_text` column.
4. `POST /api/sessions` no longer stores the `system` message row.

**Session restore flow (new)**:
1. `GET /api/sessions/:id` returns `subtitle_text` as a top-level field.
2. `useSession` reads it directly — no more delimiter parsing of the system prompt.
3. `buildChatSystemPrompt(subtitleText, videoTitle)` is called client-side when needed.

---

### Message history truncation

`POST /api/sessions/:id/messages` caps the history sent to the LLM:

```ts
const MAX_HISTORY_MESSAGES = 20
const history = getMessages(id)
const trimmed = history.slice(-MAX_HISTORY_MESSAGES)
```

The full history is still stored in DB; only the window sent to the LLM is capped.

---

### "Clear conversation" persists to DB

`VideoChat` "清空对话" button calls `PUT /api/sessions/:id/messages` with `{ messages: [] }` before clearing local state.

---

## API Design

### `POST /api/sessions` — updated request body

```jsonc
{
  "device_id": "string",
  "video_id": "string",
  "video_title": "string",
  "conversation_type": "string",
  "subtitle_text": "string",   // NEW — stored as first-class column
  "messages": [...]            // system message row removed from this array
}
```

Response unchanged: `{ session_id: string }`.

### `GET /api/sessions/:id` — updated response

```jsonc
{
  "session_id": "string",
  "video_id": "string",
  "video_title": "string",
  "conversation_type": "string",
  "subtitle_text": "string",   // NEW
  "created_at": 0,
  "messages": [...]            // only user/assistant rows (no system row)
}
```

### `PUT /api/sessions/:id/messages` — unchanged

Existing endpoint already handles `messages: []` (empty array replaces all). The validation `messages.length === 0` check must be relaxed to allow empty arrays for "clear".

---

## Shared Utilities (new files)

### `lib/llm.ts`

```ts
export function getLLMConfig() {
  const apiKey = process.env.DEEPSEEK_API_KEY || process.env.OPENAI_COMPATIBLE_API_KEY
  const apiBase = process.env.DEEPSEEK_API_URL || process.env.OPENAI_COMPATIBLE_BASE_URL || 'https://api.deepseek.com'
  const model = process.env.DEEPSEEK_MODEL || process.env.OPENAI_COMPATIBLE_MODEL || 'deepseek-chat'
  return { apiKey, apiBase: apiBase.replace(/\/+$/, ''), model }
}
```

### `lib/streamSSE.ts`

```ts
export async function* readSSEChunks(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  // yields each content chunk extracted from SSE data lines
}
```

All three route files replace their inline SSE loops with `for await (const chunk of readSSEChunks(res.body))`.

---

## Frontend State Changes

`useSession.ts`:
- Remove `extractSubtitleText()` function entirely.
- Read `subtitleText` directly from `data.subtitle_text` in the API response.
- `SessionData.subtitleText` field remains; source changes from parsed string to API field.

`HomeClient.tsx`:
- Add `subtitle_text: resolvedSubtitleText` to the `POST /api/sessions` body.
- Remove duplicate `extractBvid` function; import `extractBvidFromUrl` from `lib/bilibili.ts`.

`VideoChat.tsx`:
- "清空对话" button: call `PUT /api/sessions/${sessionId}/messages` with `{ messages: [] }` before `setMessages([])`.
- Remove unused `videoTitle` prop from `VideoChatProps`.

---

## Directory Changes

| Path | Change |
|---|---|
| `lib/llm.ts` | **New** — shared LLM config resolver |
| `lib/streamSSE.ts` | **New** — shared SSE chunk reader |
| `lib/db/index.ts` | Modified — add `globalThis` guard; add `subtitle_text` migration |
| `lib/db/sessions.ts` | Modified — `createSession` accepts `subtitle_text`; `getSession` returns it |
| `app/api/sessions/route.ts` | Modified — read `subtitle_text` from body; stop storing system message |
| `app/api/sessions/[id]/route.ts` | Modified — return `subtitle_text` in response |
| `app/api/sessions/[id]/messages/route.ts` | Modified — use `getLLMConfig`, `readSSEChunks`, cap history |
| `app/api/summarize/route.ts` | Modified — use `getLLMConfig`, `readSSEChunks` |
| `app/api/chat/route.ts` | Modified — use `getLLMConfig`, `readSSEChunks` |
| `components/SummaryViewer.tsx` | Modified — add DOMPurify sanitization |
| `components/VideoChat.tsx` | Modified — add DOMPurify, fix clear button, remove dead prop |
| `hooks/useSession.ts` | Modified — read `subtitle_text` directly, remove delimiter parser |
| `components/HomeClient.tsx` | Modified — send `subtitle_text`, remove duplicate `extractBvid` |
| `package.json` | Modified — add `dompurify`, `@types/dompurify` |
