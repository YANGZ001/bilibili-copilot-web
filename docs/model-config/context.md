# Context: Config-driven transcript model allowlist

## Decisions

- **2026-06-15** — Scope is **allowlist only**. `rpm`/`rpd` are stored in config
  but not enforced; enforcement deferred (see tasks Phase 4).
- **2026-06-15** — Display labels are the **raw model id** from config (no label
  field, no auto-derivation).
- **2026-06-15** — The previous "默认" (empty value) option is **removed**; only
  config models are selectable.
- **2026-06-15** — The **first model** in `config/models.json` is the default
  selection (relies on JS object key insertion order via `Object.keys`).
- **2026-06-15** — Config is loaded via **JSON import** (build-time bundling)
  rather than a runtime `fs` read, so it ships inside the Next.js standalone
  Docker bundle without Dockerfile/compose changes. Trade-off: edits require a
  rebuild (`docker compose up --build`), which is the project's standard workflow.

## Open questions / blockers

- None.

## Links

- Plan: `~/.claude/plans/help-create-a-config-vast-quilt.md`
