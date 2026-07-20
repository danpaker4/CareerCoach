# CareerCoach

## LiteLLM (chat-service)

Chat text completions always go through a [LiteLLM](https://docs.litellm.ai/) proxy. Model routing (Ollama default, Gemini fallback, etc.) lives in [`litellm-config.yaml`](litellm-config.yaml), not in application code.

### Configure LiteLLM

1. Start the proxy from the repo root:

```bash
docker compose up -d litellm
```

This mounts `litellm-config.yaml`, which defines:

- `chat-default` → `ollama/llama3` at `host.docker.internal:9009`
- `chat-fallback` → `gemini/gemini-2.5-flash` (uses `GEMINI_API_KEY` if set)
- router fallback from `chat-default` to `chat-fallback`

2. In `chat-service/.env`, set:

```env
LITELLM_BASE_URL=http://127.0.0.1:4000
LITELLM_API_KEY=sk-litellm-local-dev
LITELLM_MODEL=chat-default
```

### Select a provider and model

Change `LITELLM_MODEL` to a `model_name` from `litellm-config.yaml` (for example `chat-default` or `chat-fallback`), or edit the YAML to add/change upstream models. Restart LiteLLM after YAML changes; restart chat-service after `.env` changes.

### Start the chatbot with LiteLLM

1. Start Ollama (default upstream) and `docker compose up -d litellm`.
2. Apply the env vars above.
3. From `chat-service`, run `npm run dev` (and `npm run dev:worker` if you use the queue).

### Change the selected model

Edit `LITELLM_MODEL` in `chat-service/.env`, or change the upstream mapping in `litellm-config.yaml`, then restart the affected process.
