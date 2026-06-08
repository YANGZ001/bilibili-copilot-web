# Test Directory

All integration tests for bilibili-copilot-web live here as bash scripts.

Tests are **runtime integration tests** — they hit the live container and real external services (Redis, ASR). There are no unit tests or mocks.

---

## Prerequisites

- Container running: `docker compose up -d`
- `.env.local` configured with `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
- `AUDIO_TRANSCRIBE_SERVICE_URL` set for any test that exercises the ASR path

---

## Running Tests

```bash
# Run a specific test suite
bash test/asr-cache.sh

# Run against a non-default host
bash test/asr-cache.sh http://your-server:3000
```

---

## Test Scripts

| Script | What it covers |
|--------|---------------|
| `asr-cache.sh` | ASR Redis caching: Redis read/write, cache hit suppresses PROGRESS events, `bypassCache=true` triggers ASR |

---

## Writing New Tests

- One script per feature area, named `<feature>.sh`
- Use the same structure as `asr-cache.sh`: numbered sections, `pass()`/`fail()` counters, cleanup at the end
- Exit with code 1 if any test fails (`[[ "$FAIL" -eq 0 ]]` at the end)
- Seed and clean up any external state (Redis keys, DB rows) — tests must be re-runnable
- Do not hard-code BV IDs as the only valid input; pick one from the SQLite session history or accept it as an argument
- Keep `--max-time` short for tests that only need to observe the start of a long operation (e.g. ASR) — no need to wait for full completion
