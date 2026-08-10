# CareerCoach

## Self-managed MongoDB Vector Search

The jobs recommendation flow uses MongoDB Community Edition Vector Search without an Atlas deployment.
The local Docker topology contains:

- MongoDB Community Server 8.2 as a single-node replica set.
- MongoDB Search (`mongot`) 1.70.1, which maintains and queries the vector index.
- Persistent volumes for both database data and search-index data.

MongoDB is exposed on `127.0.0.1:27018` by default so it can run alongside an existing local MongoDB
on port `27017`. The application still connects only to MongoDB; MongoDB communicates with `mongot`
internally.

Start the database and search processes:

```bash
docker compose up -d mongodb mongodb-init mongot-secrets mongot
```

For a first migration from an existing local database on port `27017`, run:

```powershell
$env:SOURCE_MONGO_CONNECTION_STRING="mongodb://127.0.0.1:27017/careerCoachDB"
$env:TARGET_MONGO_CONNECTION_STRING="mongodb://127.0.0.1:27018/careerCoachDB?directConnection=true"
npm --prefix job-service run copy:mongodb-data
```

Configure every service that uses this database with:

```env
MONGO_CONNECTION_STRING=mongodb://127.0.0.1:27018/careerCoachDB?directConnection=true
```

Then backfill embeddings, enable vector search in `job-service/.env`, and verify a real vector query:

```bash
npm --prefix users-service run backfill:profile-embeddings
npm --prefix job-service run backfill:job-embeddings
npm --prefix job-service run verify:job-vector-search
```

```env
JOB_EMBEDDING_MODEL=gemini-embedding-001
JOB_EMBEDDING_DIMENSIONS=3072
JOB_VECTOR_INDEX_NAME=jobs_search_embedding_vector_index
JOB_VECTOR_INDEX_READY_TIMEOUT_MS=120000
JOBS_VECTOR_SEARCH_ENABLED=true
USERS_SERVICE_BASE_URL=http://127.0.0.1:3001
INTERNAL_SERVICE_API_KEY=local-dev-internal-service-key
```

The job service creates or updates the index definition at startup and waits until MongoDB reports
the index as queryable. For a production Community Edition deployment, use MongoDB 8.2 or newer,
deploy `mongot` alongside a replica set, use durable volumes, enable authentication and TLS, and run
multiple database/search nodes according to your availability requirements. The single-node Compose
topology is intended for local development.

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

## Langfuse Cloud AI tracing

CareerCoach can send only its explicitly marked AI observations to Langfuse Cloud while keeping the existing complete OpenTelemetry trace stream in Jaeger. Langfuse runs in the cloud; no PostgreSQL, ClickHouse, Redis, or Langfuse container is required on the VM.

1. Copy [`.env.langfuse.example`](.env.langfuse.example) to `.env.langfuse` and add the Langfuse project public and secret keys. Keep this file private and out of Git.
2. Start the existing telemetry stack with the Cloud override:

```bash
npm run langfuse:up
```

The Langfuse credentials are available only to the OpenTelemetry Collector. Application services still export to the local collector, and the collector host ports bind to `127.0.0.1`. The command starts or replaces only the collector, so it does not restart unrelated Compose services. The VM only needs outbound HTTPS access to `cloud.langfuse.com:443`.

By default, content capture is disabled. Each service supports these safe settings in its local `.env`:

```env
LANGFUSE_CAPTURE_CONTENT=false
LANGFUSE_CONTENT_MAX_CHARS=8000
```

To see chatbot prompts and responses in a remote Langfuse project, set
`LANGFUSE_CAPTURE_CONTENT=true` in the environment loaded by both the chat API and
the chat worker, then recreate both processes. The setting belongs to the application
processes, not the OpenTelemetry Collector. At startup, each process emits an
`observability.startup` log showing whether tracing and content capture are enabled.

If the chat repeatedly returns the parse fallback, check the structured
`llm.completion` and `llm.response_parse` logs. They include the requested and actual
model, finish reason, response length, and safe parse error without logging the prompt
or response body. The full redacted content remains available in Langfuse when capture
is enabled.

Set `VITE_LANGFUSE_DASHBOARD_URL=https://cloud.langfuse.com` in `frontend/.env` to show the optional external Langfuse card in Management. Never place Langfuse keys in a Vite environment variable.

To return to Jaeger-only telemetry, start Compose normally. To stop the Cloud collector override, run `npm run langfuse:stop`.
