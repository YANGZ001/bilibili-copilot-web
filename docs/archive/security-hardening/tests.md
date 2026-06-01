# Test Plan: Security Hardening & Code Quality

## Manual Test Scenarios

### Golden Path

| Step | Action | Expected |
|---|---|---|
| 1 | `docker compose up --build` | Container starts, no build errors |
| 2 | Open app, paste a Bilibili URL, click "一键课代表" | Summary streams in; no console errors |
| 3 | Ask a follow-up question in the chat panel | AI reply streams in |
| 4 | Refresh the page (same `?session=` URL) | Summary and chat history both restore correctly |
| 5 | Click "重新生成" | Summary re-streams; chat is cleared; refresh still shows new summary |
| 6 | Click "清空对话" | Chat panel empties; refresh keeps it empty |
| 7 | Click "新对话" | Returns to home; session history list shows the previous session |
| 8 | Click previous session in history | Restores correctly to step 4 state |

### XSS Verification

| Scenario | Input | Expected |
|---|---|---|
| Script tag in summary | Mock LLM response: `<script>alert(1)</script>` | No alert; rendered as escaped text |
| Inline event handler | Mock: `<img src=x onerror=alert(1)>` | No alert; `<img>` stripped or sanitized |
| Valid timestamp badge | Mock: `[03:45]` | Renders as clickable blue badge; clicking opens Bilibili at `t=225` |
| Valid image card | Mock: `[<image>@03:45]` | Renders image card button; clicking opens Bilibili at `t=225` |
| Timestamp inside event handler | Mock: `<span onmouseover=alert(1) data-timestamp="01:00">` | `onmouseover` stripped; element remains inert or removed |

### "Clear Conversation" Persistence

| Step | Action | Expected |
|---|---|---|
| 1 | Have a session with 3+ chat turns | Messages visible in chat panel |
| 2 | Click "清空对话" | Chat panel shows empty state placeholder |
| 3 | Hard-refresh (`Ctrl+Shift+R`) | Chat panel still shows empty state |
| 4 | Navigate away and back via session history | Chat panel still empty |

### Session Restore Edge Cases

| Scenario | Expected |
|---|---|
| `?session=<unknown-uuid>` | Shows home form; no crash or error message in UI |
| `?session=<expired-session-id>` | Shows "该对话已过期" message with "开启新对话" button |
| Session created before migration (no `subtitle_text`) | Restores gracefully with empty `subtitleText`; chat still works |
| Session with no assistant message (user turn only) | Summary panel shows empty; chat panel shows no messages; no JS error |

### LLM History Cap

| Scenario | Expected |
|---|---|
| Session with 25 chat turns | New question sends only the last 20 messages to LLM; response streams correctly |
| Verify in network tab | `messages` array in request body has ≤ 20 entries |

### DB Cleanup

| Step | Action | Expected |
|---|---|---|
| 1 | Insert a session with `last_accessed_at = Date.now() - 15 * 86400 * 1000` directly into SQLite | Row exists in DB |
| 2 | Restart the container | Row is gone from DB; its messages are also deleted |

---

## Automated Test Scenarios

### `lib/streamSSE.ts`

**File**: `lib/__tests__/streamSSE.test.ts`

- `readSSEChunks` yields content from well-formed SSE `data:` lines
- `readSSEChunks` skips `data: [DONE]` lines
- `readSSEChunks` handles partial lines split across chunks (buffer logic)
- `readSSEChunks` handles empty lines gracefully

### `lib/llm.ts`

**File**: `lib/__tests__/llm.test.ts`

- Returns `DEEPSEEK_API_KEY` when set
- Falls back to `OPENAI_COMPATIBLE_API_KEY`
- Strips trailing slashes from `apiBase`
- Returns default `'deepseek-chat'` model when env vars absent

### `lib/db/sessions.ts`

**File**: `lib/db/__tests__/sessions.test.ts`

- `createSession` stores `subtitle_text` correctly
- `getSession` returns `subtitle_text` in the result
- `deleteExpiredSessions` removes sessions and their messages beyond 14-day cutoff
- `deleteExpiredSessions` does not remove recent sessions

### `hooks/useSession.ts`

**File**: `hooks/__tests__/useSession.test.ts`

- When API returns session with messages `[user, assistant, user, assistant]`: `summary` = first assistant content, `chatMessages` = subsequent turns
- When API returns session with no assistant message: `summary = ''`, `chatMessages = []`, no error thrown
- When API returns 410: `expired = true`, `session = null`
- When API returns 404: `session = null`, `expired = false`

---

## Regression Checks

| Area | Risk | Check |
|---|---|---|
| Existing sessions | `subtitle_text` column migration | Sessions created before migration load without error (default `''`) |
| Retry flow | `subtitle_text` in PUT replace | After retry, session restore still works |
| Chat route (`/api/chat`) | Still used by... | Confirm `/api/chat` is still called; it was not replaced by the sessions chat endpoint |
| `SummaryViewer` timestamp clicks | DOMPurify strips `data-timestamp` | Verify `ADD_ATTR: ['data-timestamp']` is in the DOMPurify config; clicking timestamps still navigates |
| `VideoChat` timestamp clicks | Same as above | Verify in chat AI responses |
