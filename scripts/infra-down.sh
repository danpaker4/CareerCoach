#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

docker compose -f docker-compose.yml down || true
docker compose \
  -f dify/docker/docker-compose.yaml \
  --project-directory dify/docker \
  --project-name careercoach-dify \
  --env-file dify/docker/.env \
  down || true
