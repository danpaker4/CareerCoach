#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ ! -f dify/docker/.env ]]; then
  cp dify/docker/.env.example dify/docker/.env
  echo "Created dify/docker/.env from example — set SECRET_KEY and EXPOSE_NGINX_PORT=8088 if needed."
fi

echo "Starting CareerCoach infra (Langfuse, LiteLLM, RabbitMQ, ...)..."
docker compose -f docker-compose.yml up -d

echo "Starting Dify stack..."
docker compose \
  -f dify/docker/docker-compose.yaml \
  --project-directory dify/docker \
  --project-name careercoach-dify \
  --env-file dify/docker/.env \
  up -d

echo ""
echo "Ready:"
echo "  Langfuse  http://localhost:3100"
echo "  LiteLLM   http://localhost:4000"
echo "  Dify      http://localhost:8088"
echo ""
echo "Wire Dify → LiteLLM in the Dify UI (OpenAI-compatible):"
echo "  API Base  http://host.docker.internal:4000/v1"
echo "  API Key   sk-litellm-local-dev"
echo "  Model     chat-default"
echo "Then set DIFY_API_KEY in chat-service/.env (see dify/README.md)."
