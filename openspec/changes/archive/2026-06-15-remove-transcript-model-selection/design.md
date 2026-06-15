## Context

The audio-transcript-service was promoted to the primary transcript source (commit #3) and a config-driven model selector was added (commits #5, #6) so users could pick a Gemini model and switch on a 503. The service has now changed: it ignores the model parameter and instead enqueues each request across a model pool. The selector, its allowlist config, and the `?model=` query are obsolete. This change is a teardown that re-aligns the frontend and API with the new service contract.

Current flow: `app/page.tsx` reads `getModelIds()` → passes `models` to `HomeClient` → user picks one → `transcriptModel` sent in the `/api/summarize` body → route validates via `isAllowedModel`, resolves `effectiveModel` → `getCachedTranscript`/`callTranscribeService` append `?model=` and scope the cache key by model.

## Goals / Non-Goals

**Goals:**
- Remove the model selector and all model plumbing from frontend, API, and service layer.
- Keep the transcript/summarize golden path working with the service auto-selecting the model.
- Leave no dead code: delete `lib/modelsConfig.ts` and `config/models.json`.

**Non-Goals:**
- No changes to the audio-transcript-service itself (already shipped).
- No Redis cache migration; old per-model keys expire via TTL.
- No changes to the Bilibili-subtitle fallback path, retry flow, or DeepSeek summarization.

## Decisions

- **Cache key `bilibili:asr:{bvid}` (drop the model suffix).** The model is no longer a cache dimension. Alternative — keep a static `:auto` suffix — adds noise for no benefit; rejected.
- **Drop the `?model=` query entirely rather than sending `model=auto`.** The user specified the service needs no model; omitting the param is the cleanest match to "no model selection" and avoids coupling to a magic string. The service defaults to its auto behavior.
- **Delete `lib/modelsConfig.ts` and `config/models.json` outright.** Grep confirms their only importers are `app/page.tsx` and `app/api/summarize/route.ts`, both edited here, so nothing else references them.
- **Replace, not remove, the 503 hint.** Per user decision, keep a cue for the 503 case but make it model-agnostic: `转录服务繁忙，请稍后重试`.

## Risks / Trade-offs

- **Orphaned cache entries** under old `bilibili:asr:{bvid}:{model}` keys → harmless; they expire via `SUBTITLE_REDIS_CACHE_TTL_SECONDS` and are simply never read again.
- **Stale references after deletion** → mitigated by re-running the planning grep for `modelsConfig`, `getModelIds`, `getDefaultModelId`, `isAllowedModel`, `transcriptModel`, `models.json` and expecting zero hits, plus a `docker compose up --build` typecheck.
- **Env/docs drift** → `config/models.json` removal must not break the build; verified by the full Docker build, which is the project's required run convention.
