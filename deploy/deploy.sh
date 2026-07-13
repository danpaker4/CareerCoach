#!/usr/bin/env bash
# CareerCoach rollout script — run on the VM from the repo root or anywhere:
#   ./deploy/deploy.sh              # deploy latest main
#   ./deploy/deploy.sh feature/deploy
#   ./deploy/deploy.sh v1.2         # deploy a release tag
# Rollback = deploy the previous tag: ./deploy/deploy.sh v1.1
set -euo pipefail
cd "$(dirname "$0")/.."

REF="${1:-main}"

echo "==> Fetching ${REF}"
git fetch --all --tags --prune
git checkout "${REF}"
# Branches move; tags don't. Pull only when on a branch.
if git symbolic-ref -q HEAD >/dev/null; then
    git pull --ff-only
fi
echo "==> Deploying $(git rev-parse --short HEAD) ($(git log -1 --format=%s))"

echo "==> Building and starting backend containers"
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d

echo "==> Building frontend (inside node:22 — host node is too old for vite)"
if [ ! -f frontend/.env.production ]; then
    echo "ERROR: frontend/.env.production missing (copy .env.production.example and set VITE_CLIENT_ID)" >&2
    exit 1
fi
docker run --rm -v "$PWD/frontend":/app -w /app node:22 \
    bash -lc "npm ci --no-audit --no-fund && npm run build"

echo "==> Publishing frontend to /var/www/careercoach"
# One-time setup: sudo mkdir -p /var/www/careercoach && sudo chown $USER /var/www/careercoach
if [ ! -w /var/www/careercoach ]; then
    echo "ERROR: /var/www/careercoach missing or not writable (see one-time setup above)" >&2
    exit 1
fi
rsync -a --delete frontend/dist/ /var/www/careercoach/

echo "==> Status"
docker compose -f docker-compose.prod.yml ps
echo "Deployed ${REF} ($(git rev-parse --short HEAD))"
