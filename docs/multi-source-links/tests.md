# Tests: Multi-source links

## Manual scenarios (`docker compose up --build`)

1. **Bilibili regression (golden path)** — paste `https://www.bilibili.com/video/BV...`:
   summary streams, real video title shows, chat works, clicking a timestamp opens
   Bilibili at `?t=`, session reload shows the Bilibili URL/title. Redis key
   `bilibili:asr:<bvid>` (unchanged).
2. **Xiaoyuzhou** — paste `https://www.xiaoyuzhoufm.com/episode/<24hex>`: transcription
   runs via the service, summary streams, title = `小宇宙 单集 · <id>`, session reload
   shows the real Xiaoyuzhou URL, chat works. Redis key `xiaoyuzhou:asr:<id>`.
3. **Snipd** — paste `https://share.snipd.com/episode/<uuid>`: same end-to-end.
   Redis key `snipd:asr:<id>`.
4. **b23.tv short link** — still resolves and behaves as Bilibili.
5. **Invalid URL** — e.g. `https://example.com/x`: rejected client-side with the
   neutral error, no network request.
6. **ASR down for podcast** — stop the service: podcast URL surfaces the ASR error
   (no subtitle fallback); Bilibili URL falls back to subtitles as before.
7. **Legacy session** — open a pre-existing Bilibili session (no `source_url`):
   URL still reconstructs correctly from `video_id`.

## Automated

- Unit (under `test/`): `detectSource` and `extractSourceId` for representative
  Bilibili / b23.tv / Snipd / Xiaoyuzhou / invalid URLs.

## Regression checks

- Retry (force refresh) still works and rewrites session messages.
- Session history list unaffected.
- Copy-link copies the correct per-source URL.
