# Tasks: Config-driven transcript model allowlist

## Phase 1 — Infrastructure
- [x] Create `config/models.json` with `default` + `models` (rpm/rpd).
- [x] Create `lib/modelsConfig.ts` (`getModelIds`, `isAllowedModel`, `modelsConfig`).

## Phase 2 — API layer
- [x] Validate `transcriptModel` against allowlist in `app/api/summarize/route.ts`
      (400 「不支持的转录模型。」 when not allowed).

## Phase 3 — Frontend integration
- [x] `app/page.tsx` passes `getModelIds()` to `HomeClient`.
- [x] `HomeClient` accepts `models` prop, renders buttons from it (label = id),
      removes hardcoded array and the "默认" option, defaults to `models[0]`.

## Phase 4 — Deferred
- [ ] Enforce per-model `rpm`/`rpd` rate limiting (counter store + 429 handling).

## Acceptance criteria
- The "转录模型" row shows exactly the models in `config/models.json` and nothing else.
- No "默认", `gemini-2.0-flash`, or `gemini-2.5-pro` appear.
- The first config model is selected by default.
- Summarizing with a listed model works end-to-end.
- `POST /api/summarize` with a model not in config returns HTTP 400.
- Editing `config/models.json` and rebuilding updates the frontend list.
