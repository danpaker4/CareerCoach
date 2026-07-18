# CareerCoach

Local career-coaching platform: chat bot, job matching, roadmaps, and LLM observability.

## Infrastructure

Start **CareerCoach infra + Dify** together:

```bash
npm run infra:up
# stop with: npm run infra:down
```

| Service | URL |
|---------|-----|
| RabbitMQ management | http://localhost:15672 |
| MinIO console | http://localhost:9001 |
| Jaeger UI | http://localhost:16686 |
| Langfuse UI | http://localhost:3100 |
| LiteLLM proxy | http://localhost:4000 |
| Dify UI / API | http://localhost:8088 |

### How Dify + LiteLLM work together

They are not an either/or. Chat-service uses a **fallback chain**:

```
chat-service → Dify (when DIFY_API_KEY is set) → LiteLLM → Ollama / Gemini
             ↘ fallback if Dify fails / no key ↗
```

1. **LiteLLM** is always the model gateway (`chat-default` → Ollama on `:9009`, Gemini fallback).
2. **Dify** is the app layer. In the Dify UI, point its OpenAI-compatible model at `http://host.docker.internal:4000/v1` (key `sk-litellm-local-dev`, model `chat-default`).
3. After you create a Chatbot app, put its API key in `chat-service/.env` as `DIFY_API_KEY`. The chain becomes `[dify, litellm]`.

Full Dify setup steps: [dify/README.md](dify/README.md).

### Langfuse

Auto-provisioned local login (from `docker-compose.yml`):

- Email: `admin@careercoach.local`
- Password: `langfuseLocalDev1`
- Project keys: `pk-lf-local-dev` / `sk-lf-local-dev` (already wired into `chat-service/.env.example`)

### LiteLLM

`litellm-config.yaml` routes `chat-default` to Ollama on the host (`host.docker.internal:9009`) and falls back to Gemini when configured.

Ensure Ollama is running on the host (example):

```bash
OLLAMA_HOST=127.0.0.1:9009 ollama serve
```

Optional: export `GEMINI_API_KEY` before starting infra so the LiteLLM Gemini fallback works.

## Chat service

```bash
cd chat-service
cp .env.example .env   # if needed
npm install
npm run dev
npm run dev:worker
```

### Prompt regression (promptfoo)

With LiteLLM (and Ollama) running:

```bash
cd chat-service
npm run eval        # runs promptfoo against real prompt builders via LiteLLM
npm run eval:view   # opens the promptfoo results UI
```

Assertions check that decision / stage / mode-detection / dream-job prompts still return the JSON shapes the parsers expect.
