## Context

Currently `app/api/summarize/route.ts` calls `getSubtitleForVideo` (Bilibili subtitle API) first. Only when that returns `available: false` does it fall back to `callTranscribeService` (audio-transcript-service). Bilibili's AI-generated subtitles are lower quality than our own transcription, so the fallback produces better output than the primary.

## Goals / Non-Goals

**Goals:**
- Call `callTranscribeService` first on every summarize request.
- Fall back to `getSubtitleForVideo` only when `callTranscribeService` throws.
- Keep the client-facing stream protocol (`PROGRESS:`, `===METADATA_END===`, `ERROR:`) unchanged.

**Non-Goals:**
- Caching transcription results (audio-transcript-service has its own caching).
- Changing the Bilibili subtitle fetch logic or cache TTLs.
- Modifying the client/frontend.

## Decisions

### 1. Always call transcribe first, regardless of whether `AUDIO_TRANSCRIBE_SERVICE_URL` is set

**Decision**: If `AUDIO_TRANSCRIBE_SERVICE_URL` is not set, skip transcription and go directly to Bilibili fallback (same as current no-service behavior).

**Rationale**: Preserves zero-config deployments. Setting the env var opts in to the better path.

### 2. Bilibili subtitle fetch is now a silent fallback

**Decision**: Catch any error from `callTranscribeService` and call `getSubtitleForVideo` without surfacing the transcription error to the user, unless the Bilibili fallback also fails.

**Rationale**: Users don't need to know which source was used. The result is always a transcript; source is an implementation detail.

### 3. Keep stream structure identical

**Decision**: The ASR path already emits `PROGRESS:` events and then delegates to `pipeDeepSeek`. The Bilibili fallback path emits no progress events and goes straight to the DeepSeek stream. This asymmetry already exists and is kept as-is.

**Rationale**: No client changes, no regression risk.

## Risks / Trade-offs

- **Latency increase on every request**: Transcription takes minutes vs. milliseconds for a cached subtitle hit. → Acceptable: quality improvement is the explicit goal. Users see progress events during transcription.
- **Transcribe service unavailability**: If the service is down and Bilibili has no subtitles either, users get an error. → Mitigation: Bilibili fallback covers this case for videos that have subtitles.
- **10-minute timeout still applies**: Long videos may timeout. → No change from current behavior on the fallback path.

## Migration Plan

Single-file change to `app/api/summarize/route.ts`. No schema changes, no migration needed. Rollback by reverting the file.
