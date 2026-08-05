# CareerCoach — Deployment (college VM)

**This directory is deploy-only.** No application source is modified by anything here; all
behaviour differences come from configuration.

Production runs on the college VM (Ubuntu, internal IP `10.10.248.80`) behind host nginx at
**https://careercoach.cs.colman.ac.il**. Backend services run as Docker containers
(`docker-compose.prod.yml`); the frontend is a static Vite build served by nginx from
`/var/www/careercoach`. MongoDB runs in-stack (`mongodb/mongodb-atlas-local`, which bundles
mongod + mongot so `$vectorSearch` works); the VM's preinstalled MongoDB on 21771 is unused.

## Stack

| Container | Purpose | Exposure |
|---|---|---|
| users / chat / chat-worker / job / evaluation / roadmap | application services | `127.0.0.1:3001-3005` |
| rabbitmq | chat request queue | `127.0.0.1:5672`, mgmt `15672` |
| minio + minio-setup | CV/object storage | `127.0.0.1:9000`, console `9001` |
| jaeger | trace UI | via nginx `/jaeger/` (basic auth) |
| otel-collector | receives OTLP from services → Jaeger | `127.0.0.1:4317/4318` |
| litellm | LLM router for chat-service | `127.0.0.1:4000` |
| ollama + ollama-init | tiny local model (first link in the chain) | `127.0.0.1:11434` |
| mongodb | MongoDB + mongot (Atlas Search), provides $vectorSearch | `127.0.0.1:27018` |
| promptfoo-view | evaluation results UI | via nginx `/promptfoo-view/` (basic auth) |

## LLM routing

`chat-service` never calls a model directly — it calls the LiteLLM proxy, and
[`litellm-config.prod.yaml`](../litellm-config.prod.yaml) defines the chain:

```
chat-default (local llama3.2:1b) → chat-college (llama3.1:8b) → chat-gemini (gemini-2.5-flash)
```

Two things to know about the college gateway: it requires HTTP Basic Auth, and its nginx only
serves the **IP** vhost (`Host: llm.cs.colman.ac.il` returns 403). Both are handled by putting
an explicit header: `COLLEGE_LLM_AUTH_HEADER="Basic $(printf user:pass | base64)"` with
`COLLEGE_LLM_BASE_URL=http://10.10.248.41` (LiteLLM rejects credentials embedded in the URL).

The other services (users / job / roadmap) have no Basic Auth support in code, so they use
**Gemini** directly. Changing that would require application changes.

## One-time setup

1. **Clone** to `~/careercoach` on the VM.
2. **Env files** (never committed):
   - `cp deploy/env/<svc>.env.example deploy/env/<svc>.env` for each of the 5 services, fill in
     secrets, then `chmod 600 deploy/env/*.env`
   - `cp deploy/env/compose.env.example .env` (repo root — MinIO/LiteLLM/Gemini/college URL)
   - `cp frontend/.env.production.example frontend/.env.production` and set `VITE_CLIENT_ID`
3. **Jaeger credentials**:
   ```bash
   printf 'admin:%s\n' "$(openssl passwd -apr1 'YOUR_PASSWORD')" | sudo tee /etc/nginx/careercoach.htpasswd
   ```
4. **nginx**:
   ```bash
   sudo cp deploy/nginx/careercoach-proxy.inc /etc/nginx/careercoach-proxy.inc
   sudo cp deploy/nginx/careercoach.conf /etc/nginx/conf.d/careercoach.conf
   sudo nginx -t && sudo systemctl reload nginx
   ```
5. **Web root**: `sudo mkdir -p /var/www/careercoach && sudo chown $USER /var/www/careercoach`
6. First deploy: `./deploy/deploy.sh feature/deploy-v2`

## Rolling out a new version

```bash
ssh cs143@10.10.248.80
cd ~/careercoach && ./deploy/deploy.sh          # latest main
./deploy/deploy.sh v1.3                          # or a release tag
```

Tag releases (`git tag v1.x && git push --tags`) and **roll back by deploying the previous tag** —
images rebuild deterministically from the git ref.

## Smoke tests

```bash
for p in 3001 3002 3003 3004 3005; do (echo >/dev/tcp/127.0.0.1/$p) 2>/dev/null && echo "$p up"; done
docker compose -f docker-compose.prod.yml ps
curl -s http://127.0.0.1:4000/health -H "Authorization: Bearer $LITELLM_MASTER_KEY"   # LiteLLM
curl -s http://127.0.0.1:16686/ -o /dev/null -w "jaeger %{http_code}\n"
```

## Notes / gotchas

- **Health checks are TCP-level.** The application has no `/health` endpoints, so compose only
  verifies that each port accepts connections.
- **RAM is tight** (~4 GB total). The local Ollama model is deliberately tiny and unloads after
  1 minute idle (`OLLAMA_KEEP_ALIVE=1m`).
- **Jobs ETL is off**: the poller calls are commented out in `job-service/src/poller/job-poller.ts`.
  Setting `THEIRSTACK_API_KEY` alone does not start it.
- **Vector search is ON**: served by the in-stack `mongodb` container (atlas-local bundles mongot).
- **Public access** requires the college firewall to forward inbound 80/443 to the VM and public
  DNS for `careercoach.cs.colman.ac.il`. Until then the site works over VPN only.
- Mongo backups are our responsibility:
  `mongodump --uri "mongodb://<user>:<pw>@127.0.0.1:27018/careerCoachDB?authSource=admin"`

## Disk hygiene (the VM has a 40 GB disk and has filled up before)

A full disk takes MongoDB down with it — mongod aborts on `FileStreamFailed` when it
cannot write. Check `df -h /` before pulling images.

Reclaim, in order of yield:

```bash
docker builder prune -af          # build cache
docker image prune -f             # dangling images
sudo journalctl --vacuum-size=100M
```

Orphaned systemd journals are the non-obvious one: if the VM was ever re-imaged,
`/var/log/journal/` keeps directories for old machine-ids that journald no longer
manages, so `--vacuum-*` reports 0 B freed while `du` shows hundreds of MB. Remove any
directory whose name differs from `/etc/machine-id` (541 MB was reclaimed this way).

Container logs are capped at 30 MB each by the `x-logging` anchor in
docker-compose.prod.yml, and journald is capped at 200 MB by
/etc/systemd/journald.conf.d/99-cap.conf.

Largest remaining consumer is the ollama image plus its model volume (~6 GB). Dropping
the local model would free that, at the cost of the first link in the LLM fallback chain.
