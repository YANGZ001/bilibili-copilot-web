# Tests: Config-driven transcript model allowlist

## Manual scenarios

1. **Golden path** — `docker compose up --build`, open the app. The "转录模型"
   row shows exactly: `gemini-3.1-flash-lite`, `gemini-2.5-flash-lite`,
   `gemini-2.5-flash`, `gemini-3.5-flash`. The first is pre-selected.
2. **Removed options** — Confirm "默认", `gemini-2.0-flash`, and `gemini-2.5-pro`
   no longer appear.
3. **Summarize** — Submit a real BV link with a listed model; transcription runs
   and the selected model is forwarded to the transcribe service.
4. **Backend rejection** —
   `curl -X POST localhost:3000/api/summarize -H 'Content-Type: application/json' \
   -d '{"url":"BVxxxx","transcriptModel":"gemini-2.5-pro"}'`
   returns HTTP 400 「不支持的转录模型。」
5. **Config edit** — Add/remove a model in `config/models.json`, rebuild, confirm
   the frontend list updates.

## Automated scenarios

- Unit: `isAllowedModel` returns true for configured ids, false otherwise;
  `getModelIds` returns ids in config order. (Add under `test/` if/when a test
  runner is introduced — no runner is currently configured in the repo.)

## Regression checks

- Existing summarize flow without selecting a different model still works
  (default = first model now, previously the empty "默认").
- Cache key `bilibili:asr:{bvid}:{model}` still differentiates per model.

## Edge cases

- Empty `transcriptModel` in the request body is allowed (validation only rejects
  non-empty non-allowed values); in practice the UI always sends a concrete id.
