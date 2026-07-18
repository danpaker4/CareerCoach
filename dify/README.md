# Dify (bundled with CareerCoach)

Dify runs as its own Compose project (`careercoach-dify`) so its service names (e.g. `minio`) do not collide with CareerCoach infra. Start both with:

```bash
npm run infra:up
# or: bash scripts/infra-up.sh
```

## First-time setup

1. Env file (created automatically by `infra-up` if missing):

```bash
cp dify/docker/.env.example dify/docker/.env
```

CareerCoach local defaults already applied in `.env` when generated from our setup:

- `EXPOSE_NGINX_PORT=8088` (UI/API at http://localhost:8088)
- `SECRET_KEY=...` must be non-empty

2. Open Dify: http://localhost:8088 and create the admin account.

3. Add LiteLLM as the model provider (Settings → Model Providers → OpenAI-API-Compatible):

| Field | Value |
|-------|--------|
| API Base | `http://host.docker.internal:4000/v1` |
| API Key | `sk-litellm-local-dev` |
| Model name | `chat-default` |

(`host.docker.internal` reaches LiteLLM on the CareerCoach compose network from the Dify containers.)

4. Create a **Chatbot** app → **API Access** → copy the app API key.

5. Put that key in `chat-service/.env`:

```bash
DIFY_API_BASE_URL=http://127.0.0.1:8088/v1
DIFY_API_KEY=app-xxxxxxxx
```

Restart chat-api / chat-worker. The completion chain becomes `[dify, litellm]`:

```
chat-service → Dify (app) → LiteLLM (models) → Ollama/Gemini
             ↘ fallback ↗
```

Until `DIFY_API_KEY` is set, chat uses LiteLLM directly.
