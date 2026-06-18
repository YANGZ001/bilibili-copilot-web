# Context: Multi-source links

## Decisions

- **2026-06-18** — The `audio-trainscript-service` `/api/transcribe` already
  auto-detects source from `{ url }`; the web app's `type: 'bilibili'` is ignored.
  Conclusion: no service changes needed; scope is web-app only.
- **2026-06-18** — Podcast titles (initial): generic fallback `<label> 单集 · <id>`,
  because the service's `done` event returned only `{ text }`.
- **2026-06-18 (revised)** — User rejected generic titles; wants the **real title**.
  The service already stores `title` per transcription (all 3 sources). Chosen fix:
  the service's `/api/transcribe` `done` event now also emits `title` (additive,
  backward-compatible). Web app caches `{ text, title }` in Redis so the title
  survives cache hits. Generic `<label> 单集 · <id>` remains only as a fallback when
  the service returns no title (e.g. legacy string-only cache entries). Bilibili
  keeps its dedicated title fetch unchanged.
- **2026-06-18** — UI wording: **fully neutral** (replace all B站/Bilibili display
  strings, including the main heading), per user.
- **2026-06-18** — Found two latent bugs fixed by this change: podcast cache-key
  collision (`bilibili:asr:` with empty bvid) and Bilibili-only session URL
  reconstruction in `useSession.ts`.

## Verification (2026-06-18)

`docker compose up --build` succeeded; container starts, homepage returns 200.
API routing verified via curl against `/api/summarize`:
- Invalid URL (`example.com`) → 400 neutral error (detection rejects).
- Xiaoyuzhou URL → accepted, routed to service, ASR error surfaced directly (no fallback).
- Snipd URL → accepted, service identified it as a Snipd episode, ASR error surfaced directly.
- Bilibili (bad BV) → emits `PROGRESS:{step:'fallback'}` then combined ASR+subtitle
  error — confirming the Bilibili subtitle fallback path is unchanged.

Per-source cache keys (`${source}:asr:${id}`) verified in code; Bilibili stays
`bilibili:asr:${bvid}`.

**Full-link API tests (real episodes, via web app `/api/summarize`):**
- Xiaoyuzhou `69d7b5e4e2c8be3155ccc32b` → transcript (6041 chars) + DeepSeek summary;
  title `小宇宙 单集 · <id>`; metadata `videoUrl` = canonical Xiaoyuzhou URL. Done OK.
- Snipd `1b4b43d0-...` → transcript + summary; title `Snipd 单集 · <id>`. Done OK.
- Bilibili `BV1te5R6zE5f` → transcript (3896 chars) + summary; title = **real**
  Bilibili title (proves the Bilibili-only title fetch is intact). Done OK.
- Session round-trip: POST `/api/sessions` with `source_url`, GET returns it intact
  → reload builds the correct per-source URL.

**Real-title verification (after service change + rebuild of both containers):**
- Xiaoyuzhou → `咖啡豆｜《挽救计划》片头再现久违狮吼…` (also returned on a Redis cache
  hit, confirming `{text,title}` caching).
- Snipd → `How to have a safe, healthy summer`.
- Bilibili → `瞎谈谈1年前我对Scaling Law…` (dedicated fetch unchanged).

## Open questions / blockers

- None. Non-Bilibili sources have no transcript fallback — if the ASR service is
  down, podcasts surface the error directly (by design).

## Links

- Service detection source of truth: `../audio-trainscript-service/src/services/transcribePipeline.ts`
