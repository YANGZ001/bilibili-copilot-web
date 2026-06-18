# Proposal: Multi-source links (Snipd & Xiaoyuzhou)

## Background

The web app only accepts Bilibili URLs today. Client-side validation, the
summarize route, caching, session persistence, and all UI copy assume Bilibili.

The downstream `audio-trainscript-service` already transcribes three sources —
Bilibili, Snipd, and Xiaoyuzhou — by auto-detecting the source from the URL in its
`/api/transcribe` endpoint (`detectSource()` in `src/services/transcribePipeline.ts`).
The web app sends `{ type: 'bilibili', url }`, but the `type` field is ignored by
the service. So the backend is already capable; only the web app gates it.

## Goals

- Accept Snipd (`share.snipd.com/episode/...`) and Xiaoyuzhou
  (`xiaoyuzhoufm.com/episode/...`) links in addition to Bilibili.
- Produce summaries and chat for all three sources via the existing service.
- Persist and reload sessions correctly for every source (correct original URL).
- Neutral UI wording so podcasts don't read as "Bilibili videos".

## Non-Goals

- Re-implementing source download/transcription (the service already does it for
  all three). The only service change is additive: emitting the `title` it already
  stores in its `/api/transcribe` `done` event.
- Scraping podcast titles in the web app (no `SNIPD_API_KEY` here) — the title comes
  from the service instead.
- Timestamp seeking inside podcast players (podcast sites ignore `?t=`).
- Adding new sources beyond the three the service supports.

## Design Principles

- **Simplicity first**: lean on the service's existing source detection; the web
  app only mirrors the URL patterns for fast client-side validation and caching.
- **Data-driven**: a single `lib/source.ts` is the one place that knows the three
  sources; everything else asks it.
- **No regression for Bilibili**: cache keys, title fetch, and subtitle fallback
  stay byte-identical for Bilibili.

## Constraints

- Deploy via `docker compose` (Next.js app + SQLite volume + Upstash Redis cache).
- Requires `AUDIO_TRANSCRIBE_SERVICE_URL` reachable for non-Bilibili (no fallback).
- Backward compatible with existing Bilibili sessions in SQLite (no `source_url`).
