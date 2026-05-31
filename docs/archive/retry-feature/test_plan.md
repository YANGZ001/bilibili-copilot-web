# Retry Feature — Test Plan

## Prerequisites

```bash
docker compose up --build
# Open http://localhost:3000
# DB file lives at ./data/chat.db on the host (volume-mounted)
```

---

## Manual Test Cases

### T1 — Button visibility and disabled states

**Steps:**
1. Open `/` — no session loaded yet
2. Paste a video URL and click "一键课代表" — summary starts streaming
3. Wait for stream to finish and URL to update to `/?session=<uuid>`

**Expected:**
- T1a: "重新生成" button is **absent** before a session is saved (step 2 in progress)
- T1b: Button **appears** after session is saved (step 3 complete), between "在 B站 播放" and "新对话"
- T1c: Button is **grayed out / disabled** while loading is in progress
- T1d: Refreshing the page (`/?session=<uuid>`) restores the button correctly

---

### T2 — Retry streams a new summary in-place

**Steps:**
1. Open a session page with a visible summary
2. Click "重新生成"

**Expected:**
- Left panel clears and shows spinner ("正在生成总结排版...")
- Status message "课代表正在重新梳理视频逻辑，请稍候..." appears
- New summary streams in token-by-token
- After completion, full summary is visible
- URL (`?session=...`) is **unchanged**

---

### T3 — Chat messages cleared after retry

**Steps:**
1. Ask 2–3 follow-up questions in the chat panel
2. Click "重新生成" and wait for completion

**Expected:**
- Chat panel is **empty** after retry completes
- No prior Q&A messages visible

---

### T4 — New summary persists after page refresh

**Steps:**
1. Click "重新生成", wait for completion
2. Note a distinctive phrase from the new summary
3. Press F5 (hard refresh)

**Expected:**
- The **new** summary is shown (not the original)
- Chat panel is empty

**DB verification:**
```bash
python3 -c "
import sqlite3
c = sqlite3.connect('./data/chat.db')
rows = c.execute('SELECT id, role, substr(content,1,100) FROM messages ORDER BY id').fetchall()
for r in rows: print(r)
"
# Expect exactly 3 rows for the session: system / user / assistant (new summary)
# No extra user/assistant chat rows from prior Q&A
```

---

### T5 — Error recovery restores original summary

**Steps:**
1. Open a session with a visible summary
2. Click "重新生成"
3. While the spinner is running, stop the container: `docker compose down`

**Expected:**
- Error message appears in the UI
- The **original summary** is restored in the left panel
- DB unchanged (retry failed before `PUT /messages` was called)

---

### T6 — PUT /api/sessions/:id/messages API edge cases

```bash
SESSION_ID="<real-uuid-from-db>"

# Golden path → 200 {"ok":true}
curl -X PUT http://localhost:3000/api/sessions/$SESSION_ID/messages \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"system","content":"sys"},{"role":"user","content":"usr"},{"role":"assistant","content":"asst"}]}'

# Missing messages array → 400
curl -X PUT http://localhost:3000/api/sessions/$SESSION_ID/messages \
  -H "Content-Type: application/json" \
  -d '{}'

# Unknown session → 404
curl -X PUT http://localhost:3000/api/sessions/00000000-0000-0000-0000-000000000000/messages \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"x"}]}'

# Expired session → 410
python3 -c "import sqlite3; c=sqlite3.connect('./data/chat.db'); c.execute('UPDATE sessions SET last_accessed_at=0'); c.commit()"
curl -X PUT http://localhost:3000/api/sessions/$SESSION_ID/messages \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"x"}]}'
```

---

### T7 — Retry works on a page-restored session

**Steps:**
1. Open `/?session=<uuid>` directly (session loaded from DB, not freshly generated)
2. Click "重新生成"

**Expected:**
- Same behavior as T2 — `conversationType` correctly read from `session.conversation_type`
- No JS errors in console

---

## Automated Test Scenarios

> **Note:** No test framework is currently configured in this project. The scenarios below describe what should be covered when one is added (e.g. Vitest + `@testing-library/react`).

### Unit — `replaceMessages` (`lib/db/messages.ts`)

- File: `lib/db/messages.test.ts`
- Setup: in-memory SQLite DB (pass `:memory:` path)
- Cases:
  - Inserts 3 rows after replacing an empty set
  - Replaces all existing rows (old count: 5, new count: 3) — verify old rows gone
  - Runs atomically: if insert fails mid-way, no partial state (mock insert to throw after 1st row)

### Integration — `PUT /api/sessions/[id]/messages`

- File: `app/api/sessions/[id]/messages/route.test.ts`
- Cases:
  - 200: valid session + 3 messages → DB has exactly 3 rows, `last_accessed_at` updated
  - 400: empty body
  - 400: `messages: []`
  - 404: unknown session ID
  - 410: expired session

---

## Regression Checks

These adjacent features must remain unaffected after the retry changes:

| Feature | Check |
|---|---|
| Initial summarize | Submit a new URL → summary streams → session URL appears → page refresh restores |
| Follow-up chat | After initial generate, ask a question → streaming response → refresh shows history |
| Session restore | Open `/?session=<uuid>` directly → summary and chat history load from DB |
| New Conversation | Click "新对话" → navigates to `/`, form is empty, no active context |
| Expired session | Set `last_accessed_at=0`, open session URL → "该对话已过期" shown |
| POST /messages unchanged | Chat follow-up still uses `POST`, not `PUT` |

---

## Acceptance Criteria (from tasks.md)

- [ ] T1: "重新生成" button visible only after session saved; disabled during loading
- [ ] T2: Clicking it streams a new summary in the left panel without changing the URL
- [ ] T3: Chat panel is empty after retry completes
- [ ] T4: Refreshing after retry shows the new summary (persisted in DB)
- [ ] T5: If retry fails, the original summary is restored in the UI
- [ ] T6: `PUT /api/sessions/:id/messages` returns correct status codes for all edge cases
- [ ] T7: Retry works correctly on a page-restored session
