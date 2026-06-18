# Tasks: Multi-source links

## Phase 1 — Infrastructure
- [x] Add `lib/source.ts` (`detectSource`, `extractSourceId`, `sourceLabel`).
- [x] Add `source_url` column: `lib/db/index.ts` SCHEMA + MIGRATIONS.
- [x] Extend `lib/db/sessions.ts` (`Session` interface, `createSession`).

## Phase 2 — API layer
- [x] `app/api/sessions/route.ts`: accept `source_url` in POST.
- [x] `app/api/sessions/[id]/route.ts`: return `source_url`.
- [x] `app/api/summarize/route.ts`: source detection, per-source cache key,
      bilibili-only title + subtitle fallback, podcast generic title, surface
      podcast ASR errors, add `videoUrl` to metadata preamble.
- [x] `lib/bilibili.ts`: `getCachedTranscript` per-source cache key;
      `callTranscribeService` sends detected source as `type`.

## Phase 3 — Frontend integration
- [x] `hooks/useSession.ts`: use `source_url` (|| legacy Bilibili reconstruction).
- [x] `components/HomeClient.tsx`: `detectSource` validation, neutral wording,
      pass `source_url` on session create.
- [x] `lib/prompts.ts`: neutralize "Bilibili 视频字幕" in 4 templates.
- [x] `app/layout.tsx`: neutral metadata.

## Phase 4 — Verify
- [x] `docker compose up --build`; run the scenarios in tests.md.

## Acceptance criteria
- Pasting a Bilibili, Xiaoyuzhou, or Snipd episode URL produces a streamed summary
  and a working chat session.
- An unsupported URL is rejected client-side before any request.
- Reloading a session shows the correct original URL and title for its source.
- Bilibili behavior (title, subtitle fallback, Redis cache keys) is unchanged.
- Redis ASR keys are namespaced per source (no cross-source collision).
