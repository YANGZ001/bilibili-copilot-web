## Why

The downstream ASR (audio-transcript) service made a breaking change: it no longer accepts a model parameter. Requests are now enqueued internally and dispatched across a pool of models ("auto"). The web app's transcript model selector and its config-driven allowlist are now dead weight — and sending `?model=...` to the service is at best ignored, at worst an error. The frontend must stop exposing and sending model selection.

## What Changes

- **BREAKING**: Remove the `转录模型` (transcript model) selector UI from the summarize form.
- Stop sending `transcriptModel` in the `/api/summarize` request body.
- Remove the model allowlist validation and default-model resolution in the `/api/summarize` route.
- Drop the `?model=` query param and the `model` argument from the audio-transcript-service call.
- Simplify the ASR Redis cache key from `bilibili:asr:{bvid}:{model}` to `bilibili:asr:{bvid}`.
- Remove the now-dead model config plumbing: `lib/modelsConfig.ts`, `config/models.json`, and the `getModelIds()` prop wiring in `app/page.tsx`.
- Replace the model-switch 503 hint with a generic `转录服务繁忙，请稍后重试`.

## Capabilities

### New Capabilities
- `transcript-generation`: Submitting a Bilibili URL produces an AI transcript via the audio-transcript-service with the service auto-selecting the model; the frontend exposes no model choice and sends no model parameter.

### Modified Capabilities
<!-- None: openspec/specs/ is empty; behavior captured as a new capability above. -->

## Impact

- **Frontend**: `components/HomeClient.tsx` (selector block, state, request body, 503 hint), `app/page.tsx` (prop wiring).
- **API**: `app/api/summarize/route.ts` (model destructure, validation, default resolution).
- **Service layer**: `lib/bilibili.ts` (`callTranscribeService`, `getCachedTranscript`, cache key, endpoint URL).
- **Deleted files**: `lib/modelsConfig.ts`, `config/models.json`.
- **Cache**: Old per-model keys (`bilibili:asr:{bvid}:{model}`) become orphaned and expire via TTL; no migration needed.
- **External contract**: Aligns with the audio-transcript-service which no longer accepts a model parameter.
