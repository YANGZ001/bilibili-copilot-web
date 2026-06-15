# Design: Config-driven transcript model allowlist

## Data model

`config/models.json` (document, not relational):

```json
{
  "default": { "rpm": 5, "rpd": 20 },
  "models": {
    "gemini-3.1-flash-lite": { "rpm": 15, "rpd": 500 },
    "gemini-2.5-flash-lite": { "rpm": 10, "rpd": 20 },
    "gemini-2.5-flash": { "rpm": 5, "rpd": 20 },
    "gemini-3.5-flash": { "rpm": 5, "rpd": 20 }
  }
}
```

- `default`: `{ rpm, rpd }` — fallback rate limits (stored, not enforced).
- `models`: map of model id → `{ rpm, rpd }`. Key insertion order defines UI
  order; first key is the default selection.

## Core flow

```
config/models.json
   │  (import, bundled at build time)
   ▼
lib/modelsConfig.ts ──► getModelIds()   ──► app/page.tsx ──► <HomeClient models=...>
                    └─► isAllowedModel() ──► app/api/summarize (validation)
```

1. Server component `app/page.tsx` reads `getModelIds()` and passes it to
   `HomeClient` as the `models` prop.
2. `HomeClient` renders one button per id, label = id, initial selection =
   `models[0]`.
3. On submit, the selected id is sent in the POST body as `transcriptModel`.
4. `/api/summarize` validates `transcriptModel` via `isAllowedModel`; rejects with
   HTTP 400 if present and not allowed.

## API design

No new endpoints. Existing `POST /api/summarize` gains validation:
- Request body unchanged: `{ url, templateId, bypassCache, transcriptModel }`.
- New response: `400 { error: '不支持的转录模型。' }` when `transcriptModel` is a
  non-empty value not present in the config.

## Frontend state

- `HomeClient({ models }: { models: string[] })`.
- `transcriptModel` state initialized to `models[0] ?? ''`.
- Buttons rendered from `models`; selected state compares `transcriptModel === value`.

## Storage rationale

A JSON file imported at build time keeps config in the repo, version-controlled,
and bundled into the Next.js standalone output with no Dockerfile/compose change.

## Directory changes

- `config/models.json` (new)
- `lib/modelsConfig.ts` (new): `getModelIds`, `isAllowedModel`, `modelsConfig`
- `app/page.tsx` (modified): pass `models` prop
- `components/HomeClient.tsx` (modified): prop-driven model list, drop hardcoded array + "默认" option
- `app/api/summarize/route.ts` (modified): allowlist validation
