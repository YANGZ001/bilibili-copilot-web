# Proposal: Config-driven transcript model allowlist

## Background

The selectable transcript models were hardcoded in `components/HomeClient.tsx`
(`TRANSCRIPT_MODELS`), and `/api/summarize` accepted any model string the client
sent. There was no single source of truth for supported models, and no place to
record per-model rate-limit intent (rpm/rpd).

## Goals

- Introduce a `config/` directory with a single `models.json` as the source of
  truth for supported transcript models.
- Only models listed in the config are displayed/selectable in the frontend.
- The backend rejects any model not in the config.
- Store `default` and per-model `rpm`/`rpd` values for future use.

## Non-Goals

- **Rate-limit enforcement.** The `rpm`/`rpd` values are stored but not enforced.
  Enforcement (counter store, 429 handling) is deferred to a future feature.
- Runtime-editable config without a rebuild. Config is bundled at build time;
  edits apply on the next `docker compose up --build`.

## Design Principles

- **Single source of truth**: one JSON file drives both UI and backend validation.
- **Simplicity first**: JSON import (build-time bundling) instead of runtime `fs`
  reads, so it works with the Next.js standalone Docker output unchanged.
- **First model is the default**: the first entry in `models` is the default
  selection in the UI.

## Constraints

- Deploy: Docker (Next.js standalone output). Loose root files are not shipped, so
  config must be importable/bundled.
- Display labels are the raw model id strings (no separate label field).
