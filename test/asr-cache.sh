#!/usr/bin/env bash
# Tests for ASR Redis caching in /api/summarize.
#
# Requires:
#   - Container running: docker compose up -d
#   - .env.local with UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN set
#   - AUDIO_TRANSCRIBE_SERVICE_URL set (bypassCache test needs ASR reachable)
#
# Usage: bash test/asr-cache.sh [base_url]
#   base_url defaults to http://localhost:3000

set -euo pipefail

BASE_URL="${1:-http://localhost:3000}"
ENV_FILE="$(dirname "$0")/../.env.local"
BVID="BV1TTV36LEfZ"
FULL_URL="https://www.bilibili.com/video/${BVID}"
CACHE_KEY="bilibili:asr:${BVID}"
SEED_TEXT="[00:00:01 - 00:00:05] 测试字幕内容缓存验证。"

PASS=0
FAIL=0

pass() { echo "  PASS: $1"; PASS=$((PASS + 1)); }
fail() { echo "  FAIL: $1"; FAIL=$((FAIL + 1)); }

# --- Read Redis credentials ---
if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: $ENV_FILE not found" >&2; exit 1
fi
REDIS_URL=$(grep '^UPSTASH_REDIS_REST_URL=' "$ENV_FILE" | cut -d= -f2- | tr -d '"')
REDIS_TOKEN=$(grep '^UPSTASH_REDIS_REST_TOKEN=' "$ENV_FILE" | cut -d= -f2- | tr -d '"')
if [[ -z "$REDIS_URL" || -z "$REDIS_TOKEN" ]]; then
  echo "ERROR: Redis credentials not set in $ENV_FILE — skipping tests" >&2; exit 0
fi

redis_set() { curl -s -X POST "${REDIS_URL}/set/$1" -H "Authorization: Bearer ${REDIS_TOKEN}" -H "Content-Type: application/json" -d "\"$2\""; }
redis_get() { curl -s "${REDIS_URL}/get/$1" -H "Authorization: Bearer ${REDIS_TOKEN}"; }
redis_del() { curl -s -X POST "${REDIS_URL}/del/$1" -H "Authorization: Bearer ${REDIS_TOKEN}"; }

# --- Test 1: Docker / service is up ---
echo ""
echo "=== Test 1: Service health ==="
if curl -sf "${BASE_URL}" > /dev/null; then
  pass "Service is responding at ${BASE_URL}"
else
  fail "Service not reachable at ${BASE_URL} — is the container running?"
  exit 1
fi

# --- Test 2: Redis write ---
echo ""
echo "=== Test 2: Redis write ==="
R=$(redis_set "$CACHE_KEY" "$SEED_TEXT")
if echo "$R" | grep -q '"OK"'; then
  pass "Redis SET returned OK"
else
  fail "Redis SET failed: $R"
fi

# --- Test 3: Redis read ---
echo ""
echo "=== Test 3: Redis read ==="
R=$(redis_get "$CACHE_KEY")
if echo "$R" | grep -q '"result"'; then
  pass "Redis GET returned a result"
else
  fail "Redis GET returned nothing: $R"
fi

# --- Test 4: Cache hit — no PROGRESS events ---
echo ""
echo "=== Test 4: Cache hit suppresses PROGRESS events ==="
SSE=$(curl -s -N --max-time 30 -X POST "${BASE_URL}/api/summarize" \
  -H "Content-Type: application/json" \
  -d "{\"url\":\"${FULL_URL}\",\"templateId\":\"summary\",\"bypassCache\":false}")
PROGRESS_COUNT=$(echo "$SSE" | grep -c '"step"' || true)
HAS_METADATA=$(echo "$SSE" | grep -c 'METADATA_END' || true)
HAS_ERROR=$(echo "$SSE" | grep -c 'ERROR:' || true)

if [[ "$PROGRESS_COUNT" -eq 0 ]]; then
  pass "No PROGRESS events (cache hit)"
else
  fail "Got $PROGRESS_COUNT PROGRESS events — expected cache hit"
fi
if [[ "$HAS_METADATA" -gt 0 ]]; then
  pass "Got summary response (METADATA_END present)"
else
  fail "No summary in response"
fi
if [[ "$HAS_ERROR" -eq 0 ]]; then
  pass "No errors in response"
else
  fail "Got ERROR event in response"
fi

# --- Test 5: bypassCache=true triggers ASR ---
echo ""
echo "=== Test 5: bypassCache=true skips cache and calls ASR ==="
# Abort after 20s — we only need to see PROGRESS events start, not full completion
SSE=$(curl -s -N --max-time 20 -X POST "${BASE_URL}/api/summarize" \
  -H "Content-Type: application/json" \
  -d "{\"url\":\"${FULL_URL}\",\"templateId\":\"summary\",\"bypassCache\":true}" || true)
PROGRESS_COUNT=$(echo "$SSE" | grep -c '"step"' || true)
if [[ "$PROGRESS_COUNT" -gt 0 ]]; then
  pass "bypassCache=true triggered ASR ($PROGRESS_COUNT PROGRESS events)"
else
  fail "No PROGRESS events with bypassCache=true — cache may not have been bypassed"
fi

# --- Cleanup ---
echo ""
echo "=== Cleanup ==="
redis_del "$CACHE_KEY" > /dev/null
pass "Test key removed from Redis"

# --- Summary ---
echo ""
echo "==============================="
echo "Results: ${PASS} passed, ${FAIL} failed"
echo "==============================="
[[ "$FAIL" -eq 0 ]]
