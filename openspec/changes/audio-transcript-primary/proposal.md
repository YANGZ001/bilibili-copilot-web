## Why

Bilibili's AI-generated subtitles are low quality and frequently unavailable. We already have a working `audio-transcript-service` integration that produces higher-quality transcripts — it should be the primary source, not the fallback.

## What Changes

- `app/api/summarize/route.ts`: Call `callTranscribeService` first; only fall back to `getSubtitleForVideo` if the transcribe service returns an error.
- Progress events (`PROGRESS:`) are already emitted during transcription — no client changes needed; the happy path now always goes through ASR.
- Bilibili subtitle fetch becomes a last-resort fallback, only invoked when `callTranscribeService` throws.
- Cache behavior for the Bilibili fallback path is unchanged.

## Capabilities

### New Capabilities

- `transcript-priority`: Orchestration logic that tries `audio-transcript-service` first and falls back to Bilibili subtitle API on error.

### Modified Capabilities

<!-- No existing spec-level requirements are changing — this is a new orchestration rule. -->

## Impact

- **`app/api/summarize/route.ts`**: Main logic change — flip call order.
- **`lib/bilibili.ts`**: No changes; both functions remain as-is.
- **Client / frontend**: No changes; `PROGRESS:` events already handled.
- **`AUDIO_TRANSCRIBE_SERVICE_URL`**: Must be configured; if missing, behavior falls back to Bilibili-only (existing behaviour).
- **Latency**: Transcription takes longer than a cached Bilibili subtitle hit — acceptable tradeoff for quality.
