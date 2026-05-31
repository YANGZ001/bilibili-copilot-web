# Session Feature — Test Plan

## Prerequisites

### Option A: Local dev (fast iteration)
```bash
# DB_PATH=./data/chat.db is already set in .env.local
# data/ directory already created
npm run dev
# NOTE: if port 3000 is in use the server will silently bind to 3001.
# Check the terminal output for the actual port before testing.
```

### Option B: Docker (production parity)
```bash
docker compose up --build
# Open http://localhost:3000
# DB file lives at ./data/chat.db on the host (volume-mounted)
```

---

## Test Cases

### T1 — New session creation ✅ API verified
**Steps:**
1. Open `/` — confirm input form is shown
2. Paste a Bilibili URL, pick a template, click "一键课代表"
3. Watch the address bar

**Expected:**
- Summary streams in as before
- After stream completes, URL changes to `/?session=<uuid>`
- Video title banner and chat panel remain visible

**API verification (2025-05-31):**
`POST /api/sessions` with 3 initial messages → `{"session_id":"d30d3169..."}`.
DB confirmed: 1 session row, 3 message rows (`system` / `user` / `assistant`) in correct order.

---

### T2 — Session restore on refresh ✅ API verified
**Steps:**
1. With a `/?session=<uuid>` URL open, press F5 (hard refresh)

**Expected:**
- Brief loading spinner appears
- Full summary and video title banner are restored
- Chat box is empty (no prior follow-ups yet)

**API verification (2025-05-31):**
`GET /api/sessions/:id` returned all 3 messages with correct roles and video metadata.
`last_accessed_at` was updated on every GET (confirmed via before/after DB read).

---

### T3 — Follow-up persistence ✅ API verified
**Steps:**
1. On a session page, ask a follow-up question in the chat box
2. Wait for the streaming response to complete
3. Refresh the page

**Expected:**
- The user question and AI response are present in the chat box after refresh

**API verification (2025-05-31, session `2f71dd56`):**
`POST /api/sessions/:id/messages` with real question about FIRE路线 — LLM streamed a contextually correct answer (corrected a false premise about 60万).
DB after follow-up: 5 messages total (IDs 10–14) — original 3 + new `user` + `assistant` confirmed.

---

### T4 — New Conversation button ✅ verified by user
**Steps:**
1. While on a session page, click **新对话** in the video banner (top right)

**Expected:**
- URL changes to `/`
- Empty input form is shown
- No summary or chat panel visible

**Verification (2026-05-31):** Confirmed working by user in browser.

---

### T5 — Expired session ✅ API verified
**Steps:**
```bash
# Manually expire all sessions in the DB
python3 -c "import sqlite3; c=sqlite3.connect('./data/chat.db'); c.execute('UPDATE sessions SET last_accessed_at=0'); c.commit()"
```
2. Visit the session URL (`/?session=<uuid>`)

**Expected:**
- "该对话已过期" message is shown
- "开启新对话" button navigates to `/`

**API verification (2025-05-31):**
`GET` on expired session → `410 {"error":"Session expired"}`.
`POST /messages` on expired session → also `410`.
Expired sessions excluded from `GET /api/sessions?device_id=xxx` list.

*Note: `sqlite3` CLI not available in this environment — use the Python snippet above.*

---

### T6 — DB persistence across restarts ✅ verified
**Steps:**
1. Create a session, note its URL
2. `docker compose down`
3. `docker compose up`
4. Visit the session URL

**Expected:**
- Session is fully restored (`data/` volume preserved the `.db` file)

**Verification (2025-05-31, session `2f71dd56`):**
`docker compose down` + `docker compose up -d` → `GET /api/sessions/2f71dd56` returned all 5 messages intact. Volume mount confirmed working.

---

### T7 — DB content inspection ✅ verified
```bash
# sqlite3 not available in this env — use Python instead:
python3 -c "
import sqlite3
c = sqlite3.connect('./data/chat.db')
print('Tables:', c.execute(\"SELECT name FROM sqlite_master WHERE type='table'\").fetchall())
print('Sessions:', c.execute('SELECT session_id, video_title, conversation_type FROM sessions').fetchall())
print('Messages:')
for r in c.execute('SELECT id, role, substr(content,1,80) FROM messages ORDER BY id').fetchall(): print(r)
"
```

**Verified (2025-05-31):** Tables `sessions` + `messages` present. Session and message rows correct.

---

## Edge Cases & Probes ✅ all verified (2025-05-31)

| Probe | Input | Result |
|---|---|---|
| Unknown session ID | `GET /api/sessions/00000000-...` | `404 {"error":"Session not found"}` |
| Missing `video_id` in POST | `POST /api/sessions {device_id only}` | `400 {"error":"Missing required fields"}` |
| Follow-up with `role: assistant` | `POST /api/sessions/:id/messages` | `400 {"error":"Missing or invalid message"}` (prompt injection blocked) |
| Wrong HTTP method on messages | `GET /api/sessions/:id/messages` | `405` |
| subtitleText extraction | delimiter parsing from system message | correct multi-line extraction confirmed |

---

## Acceptance Criteria (from design doc)

- [x] T1+T2: After submission URL becomes `/?session=uuid`; refreshing fully restores the conversation *(API verified)*
- [x] T3: On restore, user can continue follow-ups and LLM understands video context *(verified with real video)*
- [x] T4: "New Conversation" returns to `/` with a reset form *(verified by user)*
- [x] T5: Expired session URL shows a friendly expiry message *(API verified)*
- [x] T6: `.db` file persists across Docker restarts *(verified)*

---

## Known Issues / Notes

- Port 3000 may already be in use when running `npm run dev`; server will silently bind to the next available port (e.g. 3001). Check terminal output.
- `sqlite3` CLI not installed in this environment — use the Python `sqlite3` module instead for DB inspection.
