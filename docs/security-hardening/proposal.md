# Proposal: Security Hardening & Code Quality

## Background

A code review (2026-06-01) identified one critical XSS vulnerability, four medium-severity correctness bugs, and seven low-severity code quality issues in the current codebase. The app is deployed on a private Tailscale network, which reduces exposure, but the XSS bug is exploitable by any malicious Bilibili video subtitle — no network access required. The correctness bugs cause silent data loss and broken session restores that degrade the user experience today.

## Goals

1. Eliminate the XSS vector in `SummaryViewer` and `VideoChat` by sanitizing all LLM-generated HTML before rendering.
2. Fix the four medium-severity correctness bugs:
   - "Clear conversation" not persisting to DB
   - Off-by-one in `useSession` when no assistant message exists
   - Fragile subtitle extraction from system prompt string
   - Unbounded message history sent to the LLM
3. Reduce duplication and improve maintainability:
   - Extract SSE stream parsing into a shared utility
   - Extract LLM config resolution into a shared utility
   - Remove the dead `videoTitle` prop and duplicated BVID regex
   - Add DB cleanup for expired sessions

## Non-Goals

- Adding new user-facing features (export, batch processing, etc.)
- Changing the UI or UX in any visible way
- Migrating storage engines or changing the API surface
- Adding authentication / authorization (Tailscale is the auth boundary)

## Design Principles

- **Surgical changes only**: every change targets a specific finding; no opportunistic refactoring beyond scope.
- **No new dependencies** except `dompurify` + its `@types` for XSS sanitization.
- **Backwards-compatible DB changes**: the `subtitle_text` column addition uses `ALTER TABLE ... ADD COLUMN` with a default so existing rows are unaffected.
- **No API contract changes**: all existing endpoints keep the same method, path, request, and response shape.

## Constraints

- Must continue to run via `docker compose up --build` — no build-step changes.
- Must not break existing sessions stored in SQLite (schema migration must be additive).
- `better-sqlite3` native addon must remain compiled in the builder stage.
