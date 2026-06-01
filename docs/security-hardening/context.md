# Context: Security Hardening & Code Quality

## Decision Log

### 2026-06-01 — Project scoped from code review

Full code review of `master` branch identified 1 critical, 4 medium, and 7 low findings. Decision: address all critical + medium + high-value lows in a single project rather than spreading across multiple PRs. Rationale: the changes are interconnected (subtitle_text refactor touches DB, API, and frontend simultaneously), and the project is small enough to ship as one unit.

### 2026-06-01 — `dompurify` chosen over `sanitize-html`

`dompurify` runs in the browser (no Node dependency), is the de-facto standard for `dangerouslySetInnerHTML` sanitization, and has zero transitive dependencies. `sanitize-html` is Node-first and heavier. Only needed in two client components.

### 2026-06-01 — Store `subtitle_text` as DB column, not re-parsed from system prompt

The current pattern stores subtitle text inside the system prompt string and parses it back out using delimiter markers. Two problems: (a) any whitespace or format change to `buildChatSystemPrompt` silently breaks all existing session restores; (b) the system message row is stored in `messages` even though it is never sent to the client as a visible message. Moving `subtitle_text` to a proper column decouples prompt formatting from persistence.

### 2026-06-01 — Stop storing the `system` message row in `messages` table

The system prompt is constructed client-side from `subtitle_text` + `video_title` via `buildChatSystemPrompt`. There is no need to persist it — it can always be reconstructed. Removing it from the `messages` table simplifies `GET /api/sessions/:id` (no filtering needed) and `useSession.ts` (no role=system special-casing).

### 2026-06-01 — MAX_HISTORY_MESSAGES = 20

A cap of 20 messages (10 turns) covers typical Q&A usage while bounding token cost. The full history remains in DB; only the LLM window is trimmed. This value is a constant in the route file for easy adjustment; no env var needed at this stage.

### 2026-06-01 — `PUT /api/sessions/:id/messages` with `messages: []` for "clear"

The existing PUT endpoint already implements `replaceMessages` which deletes then re-inserts. Sending `[]` naturally clears all messages. The only change needed is relaxing the `messages.length === 0` validation guard that currently rejects empty arrays.

## Open Questions

- Should `deleteExpiredSessions()` run only at startup, or on a periodic interval? For a personal single-user app, startup-only is sufficient. Revisit if the app sees long-running uptime with heavy use.
- Should `MAX_HISTORY_MESSAGES = 20` be configurable via an env var? Deferred — hardcoded constant is fine for now.

## Blockers

None currently.
