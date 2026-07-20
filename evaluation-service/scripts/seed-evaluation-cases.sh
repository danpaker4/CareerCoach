#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${EVALUATION_SERVICE_BASE_URL:-http://127.0.0.1:3004}"
CASES_DIR="$(cd "$(dirname "$0")/../fixtures/evaluation-cases" && pwd)"

created=0
skipped=0
failed=0

for file in "$CASES_DIR"/eval-*.json; do
  [ -f "$file" ] || continue
  case_id="$(basename "$file" .json)"
  response="$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/evaluation-cases" \
    -H "Content-Type: application/json" \
    --data-binary "@${file}")"
  status_code="$(echo "$response" | tail -n 1)"
  body="$(echo "$response" | sed '$d')"

  if [ "$status_code" = "201" ]; then
    echo "Created ${case_id}"
    created=$((created + 1))
  elif [ "$status_code" = "409" ]; then
    echo "Skipped ${case_id} (already exists)"
    skipped=$((skipped + 1))
  else
    echo "Failed ${case_id} (HTTP ${status_code}): ${body}"
    failed=$((failed + 1))
  fi
done

echo "---"
echo "Created: ${created}, Skipped: ${skipped}, Failed: ${failed}"

if [ "$failed" -gt 0 ]; then
  exit 1
fi
