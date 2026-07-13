# CareerCoach — Deployment (college VM)

Production runs on the college VM (Ubuntu, internal IP 10.10.248.80) behind host nginx at
**https://careercoach.cs.colman.ac.il**. Backend services run as Docker containers
(`docker-compose.prod.yml`); the frontend is a static Vite build served by nginx from
`/var/www/careercoach`. MongoDB is the VM's host instance on port 21771. All LLM traffic
goes to the college service at `http://llm.cs.colman.ac.il` (HTTP Basic Auth).

## One-time setup

1. **Clone** the repo to `~/careercoach` on the VM.
2. **Env files** (never committed):
   - `cp deploy/env/<svc>.env.example deploy/env/<svc>.env` for each of the 5 services and fill in
     secrets (Mongo password, `LLM_BASIC_AUTH`, JWT secrets, `INTERNAL_SERVICE_API_KEY`, MinIO creds,
     GitHub OAuth). `chmod 600 deploy/env/*.env`
   - `cp deploy/env/compose.env.example .env` (repo root — MinIO credentials for compose).
   - `cp frontend/.env.production.example frontend/.env.production` and set `VITE_CLIENT_ID`.
3. **nginx**:
   ```bash
   sudo cp deploy/nginx/careercoach-proxy.inc /etc/nginx/careercoach-proxy.inc
   sudo cp deploy/nginx/careercoach.conf /etc/nginx/sites-available/careercoach
   sudo ln -sf /etc/nginx/sites-available/careercoach /etc/nginx/sites-enabled/careercoach
   sudo nginx -t && sudo systemctl reload nginx
   ```
   Check the TLS cert/key filenames in the conf against what exists in `/etc/ssl/cs`.
4. First deploy: `./deploy/deploy.sh feature/deploy` (or `main` once merged).

## Rolling out a new version

```bash
ssh cs143@10.10.248.80
cd ~/careercoach && ./deploy/deploy.sh          # latest main
./deploy/deploy.sh v1.3                          # or a release tag
```

Recommended flow: tag releases on GitHub (`git tag v1.x && git push --tags`), deploy tags, and
**roll back by deploying the previous tag** — images rebuild deterministically from the git ref.

## Smoke tests

```bash
for p in 3001 3002 3003 3004 3005; do curl -fsS http://127.0.0.1:$p/health && echo " <- $p"; done
docker compose -f docker-compose.prod.yml ps      # all healthy
curl -u "$LLM_USER:$LLM_PASS" http://llm.cs.colman.ac.il/api/tags   # LLM reachable
```

## Notes / gotchas

- The college LLM allows ~10 generate-requests/min per IP shared by all services; heavy demos can
  hit 429s. Optionally set `GEMINI_API_KEY` in chat/roadmap env files as an automatic fallback.
- The VM firewall must allow inbound 80/443 (request from the admin) for public access.
- Mongo backups are our responsibility: `mongodump --uri "mongodb://admin:<pw>@127.0.0.1:21771/careerCoachDB?authSource=admin"`.
- The GitHub OAuth app callback must point at `https://careercoach.cs.colman.ac.il`.
