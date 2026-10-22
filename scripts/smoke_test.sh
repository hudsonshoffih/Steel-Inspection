#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-http://localhost:8080}"
BASE_URL="${BASE_URL%/}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SAMPLE_IMAGE="$(find "$PROJECT_ROOT/sample_data" -type f \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' \) -print -quit)"
TEMP_FILE="$(mktemp)"
trap 'rm -f "$TEMP_FILE"' EXIT

if [[ -z "$SAMPLE_IMAGE" ]]; then
  echo "No sample image found under sample_data." >&2
  exit 1
fi

check_status() {
  local expected="$1"
  local actual="$2"
  local description="$3"
  if [[ "$actual" != "$expected" ]]; then
    echo "FAIL: $description (expected HTTP $expected, got $actual)" >&2
    exit 1
  fi
  echo "PASS: $description"
}

check_status "200" "$(curl -sS -o /dev/null -w '%{http_code}' "$BASE_URL/")" "dashboard is served"
check_status "200" "$(curl -sS -o /dev/null -w '%{http_code}' "$BASE_URL/health")" "AI health endpoint is proxied"
check_status "200" "$(curl -sS -o /dev/null -w '%{http_code}' "$BASE_URL/api/gateway/health")" "gateway health endpoint responds"
check_status "200" "$(curl -sS -o /dev/null -w '%{http_code}' "$BASE_URL/api/database/stats")" "database API responds"
check_status "200" "$(curl -sS -o /dev/null -w '%{http_code}' \
  -F "file=@$SAMPLE_IMAGE" \
  -F 'sheet_id=SMOKE-TEST' \
  "$BASE_URL/api/inspect/image")" "sample image upload succeeds"

printf 'not an image' > "$TEMP_FILE"
check_status "415" "$(curl -sS -o /dev/null -w '%{http_code}' \
  -F "file=@$TEMP_FILE;type=text/plain" \
  "$BASE_URL/api/inspect/image")" "non-image uploads are rejected"

dd if=/dev/zero of="$TEMP_FILE" bs=1048576 count=10 2>/dev/null
printf 'x' >> "$TEMP_FILE"
check_status "413" "$(curl -sS -o /dev/null -w '%{http_code}' \
  -F "file=@$TEMP_FILE;type=image/jpeg" \
  "$BASE_URL/api/inspect/image")" "uploads larger than 10 MB are rejected"

check_status "400" "$(curl -sS -o /dev/null -w '%{http_code}' \
  -H 'Content-Type: application/json' \
  -d '{"sheet_id":"../x"}' \
  "$BASE_URL/api/inspection/start")" "unsafe sheet IDs are rejected"

echo "ALL CHECKS PASSED"
