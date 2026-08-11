#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${EVALUATION_SERVICE_BASE_URL:-http://127.0.0.1:3004}"
CASES_DIR="$(cd "$(dirname "$0")/../fixtures/evaluation-cases" && pwd)"

created=0
updated=0
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
    continue
  fi

  if [ "$status_code" = "409" ]; then
    replace_response="$(curl -s -w "\n%{http_code}" -X PUT "${BASE_URL}/evaluation-cases/${case_id}" \
      -H "Content-Type: application/json" \
      --data-binary "@${file}")"
    replace_status="$(echo "$replace_response" | tail -n 1)"
    replace_body="$(echo "$replace_response" | sed '$d')"
    if [ "$replace_status" = "200" ]; then
      echo "Updated ${case_id}"
      updated=$((updated + 1))
    else
      echo "Failed ${case_id} replace (HTTP ${replace_status}): ${replace_body}"
      failed=$((failed + 1))
    fi
    continue
  fi

  echo "Failed ${case_id} (HTTP ${status_code}): ${body}"
  failed=$((failed + 1))
done

echo "---"
echo "Created: ${created}, Updated: ${updated}, Failed: ${failed}"

if [ "$failed" -gt 0 ]; then
  exit 1
fi
