## 1. Frontend — components/HomeClient.tsx

- [x] 1.1 Change the component signature from `{ models }: { models: string[] }` to no props
- [x] 1.2 Delete the `transcriptModel` state declaration
- [x] 1.3 Delete the `{/* Transcript Model */}` selector block
- [x] 1.4 Remove `transcriptModel` from the `handleSummarize` request body
- [x] 1.5 Replace the 503 hint text with `转录服务繁忙，请稍后重试`

## 2. Entry point — app/page.tsx

- [x] 2.1 Remove the `getModelIds` import and render `<HomeClient />` with no `models` prop

## 3. API route — app/api/summarize/route.ts

- [x] 3.1 Remove `transcriptModel` from the destructured request body
- [x] 3.2 Delete the allowlist validation block and the `effectiveModel` resolution line
- [x] 3.3 Remove the `isAllowedModel`/`getDefaultModelId` import from `@/lib/modelsConfig`
- [x] 3.4 Call `getCachedTranscript` without the model argument

## 4. Service layer — lib/bilibili.ts

- [x] 4.1 Remove the `model?: string` param from `getCachedTranscript` and `callTranscribeService`
- [x] 4.2 Simplify the cache key to `bilibili:asr:${bvid}`
- [x] 4.3 Replace the conditional endpoint with the plain `${serviceUrl}/api/transcribe` (drop `?model=`)

## 5. Delete dead config

- [x] 5.1 Delete `lib/modelsConfig.ts`
- [x] 5.2 Delete `config/models.json`

## 6. Verify

- [x] 6.1 Re-run grep for `modelsConfig|getModelIds|getDefaultModelId|isAllowedModel|transcriptModel|models.json|转录模型`; expect zero hits
- [x] 6.2 `docker compose up --build` succeeds (typecheck/build clean)
- [x] 6.3 Manual E2E: form has no `转录模型` row; a real BV URL streams a summary; logs show cache key `bilibili:asr:<bvid>` with no model suffix
