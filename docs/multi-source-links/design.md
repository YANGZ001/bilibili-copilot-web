# Design: Multi-source links

## Source detection (`lib/source.ts`, new)

Mirrors `audio-trainscript-service`'s `detectSource`:

| Source     | detect regex                       | id regex (cache/session id)          |
|------------|------------------------------------|--------------------------------------|
| bilibili   | `/bilibili\.com\|b23\.tv/i`        | `/\/video\/(BV[a-zA-Z0-9]+)/i`       |
| snipd      | `/share\.snipd\.com\/episode\//i`  | `/episode\/([0-9a-f-]{36})/i` (UUID) |
| xiaoyuzhou | `/xiaoyuzhoufm\.com\/episode\//i`  | `/episode\/([0-9a-f]{24})/i`         |

- `detectSource(url): Source | null`
- `extractSourceId(url, source): string` — `''` when no id matches.
- `sourceLabel(source): string` — display label (`B站` / `小宇宙` / `Snipd`),
  used only for the podcast fallback title prefix.

## Data model

`sessions` gains one additive column:

```
source_url TEXT NOT NULL DEFAULT ''   -- canonical original URL for the session
```

Applied via the existing `MIGRATIONS` try/catch in `lib/db/index.ts`. Old rows keep
`''`; the client falls back to reconstructing the Bilibili URL from `video_id` for
those legacy rows.

## Core flow

```
user URL
  -> HomeClient: detectSource(url) != null ? proceed : show neutral error
  -> POST /api/summarize { url }
       resolvedUrl = resolveShortUrl(url)        (b23.tv only; no-op otherwise)
       source      = detectSource(resolvedUrl)   (400 if null)
       sourceId    = extractSourceId(resolvedUrl, source)
       transcript  = getCachedTranscript(source, sourceId, resolvedUrl, ...)
                       key = `${source}:asr:${sourceId}`
       transcript = { text, title }  // title from service `done` event, cached together
       title:
         bilibili   -> fetch from Bilibili API (unchanged)
         podcast    -> service-resolved title, else `${sourceLabel} 单集 · ${sourceId}`
       on ASR error:
         bilibili   -> getSubtitleForVideo fallback (unchanged)
         podcast    -> surface ASR error (no fallback)
       metadata preamble adds videoUrl = resolvedUrl
  -> client persists session { video_id: sourceId, source_url: resolvedUrl, ... }
  -> reload: useSession uses source_url (|| legacy Bilibili reconstruction)
```

## API design

- `POST /api/summarize` — body unchanged (`{ url, templateId, bypassCache }`).
  Metadata preamble JSON gains `videoUrl`. Returns 400 for unsupported URLs.
- `POST /api/sessions` — body gains optional `source_url`.
- `GET /api/sessions/:id` — response gains `source_url`.
- Transcribe service call: `{ type: <detected source>, url }` (type still ignored
  by the service; sent for honesty).
- **Service change (audio-trainscript-service `src/index.ts`)**: the `/api/transcribe`
  `done` event now emits `{ text, title }` instead of `{ text }` (additive; the
  `title` is read from the transcription row the handler already loads). The web app's
  `callTranscribeService` parses it; `getCachedTranscript` returns/caches
  `{ text, title }` and treats legacy bare-string cache entries as `{ text }`.

## Frontend state

`SessionData.video_url` is now sourced from `source_url` (falling back to the
Bilibili reconstruction for legacy rows). `ActiveContext` is unchanged — it already
carries `videoUrl`, which now holds the real per-source URL.

## Storage rationale

SQLite session store is unchanged; one nullable-with-default column is the minimal
additive change and is covered by the existing idempotent migration mechanism.

## Directory changes

- NEW `lib/source.ts`
- `lib/db/index.ts`, `lib/db/sessions.ts`
- `app/api/sessions/route.ts`, `app/api/sessions/[id]/route.ts`
- `hooks/useSession.ts`
- `app/api/summarize/route.ts`, `lib/bilibili.ts`
- `lib/prompts.ts`, `components/HomeClient.tsx`, `app/layout.tsx`
