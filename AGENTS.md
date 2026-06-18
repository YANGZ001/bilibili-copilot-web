
<!-- BEGIN agent-guidelines -->
# Common Agent Rules

## Feature Development Workflow

Every new feature must go through a design phase before any code is written. Docs live under `repo_root/docs/<feature-name>/` and contain five files.

```
docs/
  <feature-name>/          # active — in progress
    proposal.md   # Background, goals, non-goals, design principles
    design.md     # Data model, API design, frontend state, directory changes
    tasks.md      # Phased task checklist + acceptance criteria
    context.md    # Running log of decisions, blockers, and open questions
    tests.md      # Manual + automated test scenarios, edge cases, acceptance checks
  archive/
    <feature-name>/        # completed and verified features
```

When all acceptance criteria are met and verified, move the feature folder to `repo_root/docs/archive/`.

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

### tests.md must include

- Manual test scenarios covering the golden path and key edge cases
- Automated test scenarios (unit + integration) with file paths
- Regression checks for features adjacent to the new work
- Maintain test cases under `repo_root/test/`.

---

## Todo List

A single `repo_root/todo.md` tracks all pending work across every project in this repo. Keep it up to date:

- Add items when new tasks or bugs are identified.
- When a todo item is ready to start, move it out of `todo.md` and create the corresponding `docs/<feature-name>/` folder instead.

---

## Decision Ownership

Surface key decisions to the user before acting on them. Do not resolve significant design or scope choices unilaterally.

---

## Relationship to Karpathy Guidelines

These rules complement the [Karpathy guidelines](https://raw.githubusercontent.com/multica-ai/andrej-karpathy-skills/main/CLAUDE.md) and must not duplicate or contradict them.

The Karpathy guidelines own: **Think Before Coding**, **Simplicity First**, **Surgical Changes**, and **Goal-Driven Execution**. Do not restate or override those principles here.

Rules added to this file must cover workflow, process, or project-specific conventions that the Karpathy guidelines do not address (e.g. doc structure, build tooling, todo tracking).

---

## Build & Run Convention

**Always use `docker compose` — never `npm run build` or `npm run dev`.**

```bash
docker compose up --build   # build and start
docker compose up -d        # start in background
docker compose down         # stop
```

---

## CSS Gotchas

### `overflow-x: hidden` breaks `position: sticky`

Any ancestor with `overflow` set to anything other than `visible` becomes the sticky scroll container. If that ancestor doesn't itself scroll, sticky stops working entirely.

- **Wrong:** `overflow-x-hidden` on a parent of a sticky element
- **Right:** `[overflow-x:clip]` — clips overflow visually without creating a scroll container

### `globals.css` CSS variables override Tailwind body classes

`globals.css` sets `body { background: var(--background) }` with `--background: #ffffff` by default. This wins over a Tailwind `bg-*` class added to `<body>` in `layout.tsx` due to CSS layer ordering.

- **Fix:** Update `--background` in `globals.css` to match the app's actual background color, for both the default and `prefers-color-scheme: dark` blocks.

# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
<!-- END agent-guidelines -->
