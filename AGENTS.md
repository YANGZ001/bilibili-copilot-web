<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# Project Development Standards

## Feature Development Workflow

Every new feature must go through a design phase before any code is written. Docs live under `docs/<feature-name>/` and contain five files. Use `docs/session-feature/` as the canonical reference:

```
docs/
  <feature-name>/
    proposal.md   # Background, goals, non-goals, design principles
    design.md     # Data model, API design, frontend state, directory changes
    tasks.md      # Phased task checklist + acceptance criteria
    context.md    # Running log of decisions, blockers, and open questions
    test_plan.md  # Manual + automated test scenarios, edge cases, acceptance checks
```

### proposal.md must include

- **Background**: What problem exists today
- **Goals**: What this feature will deliver
- **Non-Goals**: Explicitly what is out of scope (prevents scope creep)
- **Design Principles**: Key decision rationale (e.g. "simplicity first", "data-driven UI")
- **Constraints**: Deploy environment, performance requirements, compatibility

### design.md must include

- **Data model**: Table schema (fields, types, descriptions); relational vs document distinction
- **Core flow**: Key scenarios described in prose + ASCII diagrams
- **API design**: Method, path, request body, response for every endpoint
- **Frontend state**: State shape, data flow, hook responsibilities
- **Storage rationale**: Why this storage engine was chosen
- **Directory changes**: List of new/modified files

### tasks.md must include

- Tasks split by Phase (Phase 1 = infrastructure, Phase 2 = API layer, Phase 3 = frontend integration, Phase 4+ = deferrable)
- Each task as a `- [ ]` checkbox for progress tracking
- **Acceptance criteria** at the end, expressed as observable user-facing behaviors

### context.md must include

- Running log of decisions made during implementation (date-stamped entries)
- Open questions and blockers, updated as they are resolved
- Links to relevant commits or PRs

### test_plan.md must include

- Manual test scenarios covering the golden path and key edge cases
- Automated test scenarios (unit + integration) with file paths
- Regression checks for features adjacent to the new work

---

## Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Framework | Next.js (App Router) | Read `node_modules/next/dist/docs/` before writing code |
| Language | TypeScript | Strict types; no `any` |
| Styling | Tailwind CSS | Already configured |
| Database | SQLite (`better-sqlite3`) | Personal-use; zero external dependencies |
| Deploy | Docker + docker-compose | Volume mount for data persistence |
| Network | Tailscale private network | No public auth needed |

---

## Database Conventions

- Use SQLite; `.db` file at `/data/chat.db`, persisted via Docker volume
- Connection singleton in `lib/db/index.ts`; auto-runs `lib/db/schema.sql` on startup
- Data access split by entity: `lib/db/sessions.ts`, `lib/db/messages.ts`, etc.
- Never write raw SQL directly in API route files — always go through `lib/db/*.ts`

---

## API Conventions

- RESTful routes: `/api/sessions`, `/api/sessions/[id]/messages`
- All API route files must include `export const runtime = 'nodejs'` (required for SQLite)
- Error response format: `{ error: string }` with semantically correct status codes (404 / 410 / 500)
- Streaming responses use `ReadableStream` with `Content-Type: text/event-stream`

---

## Frontend Conventions

- **Data-driven UI**: Components care only about *what the data is*, not *where it came from* (new and restored sessions share the same render path)
- **URL as single source of truth**: Session state flows through URL query params; no global store
- **device_id** managed exclusively via `getOrCreateDeviceId()` in `lib/device.ts`; stored in `localStorage`
- Hooks have single responsibility: `useSession(id)` only loads and caches session data — no business logic

---

## Dockerfile Notes

- Use multi-stage builds (builder + runner)
- `better-sqlite3` is a native addon; it must be compiled in the builder stage and `node_modules` must be copied in full to the runner stage — do NOT prune to production-only deps or the `.node` file will be missing
- Explicitly create `/data` in the runner stage: `RUN mkdir -p /data`
- docker-compose volume: `./data:/data`

---

## Build & Run Convention

**Always use `docker compose` — never `npm run build` or `npm run dev`.**

```bash
docker compose up --build   # build and start
docker compose up -d        # start in background
docker compose down         # stop
```

`npm run build` is forbidden as the production entry point because it skips the native-addon compilation step and runs outside the Docker volume that persists `/data`. All testing and verification must also go through `docker compose`.

