# Promptfoo evaluation for CareerCoach

Promptfoo is an **optional** evaluation runner alongside the existing evaluation-service.
It does **not** replace the evaluation-service, fixtures, scoring logic, or Management UI.

```text
evals/promptfoo/
├── promptfooconfig.ts
├── promptfooconfig.compare.ts
├── providers/
│   ├── evaluation-provider.ts
│   └── provider-env.ts
├── assertions/
│   └── custom-assertions.ts
├── scripts/
│   ├── generate-promptfoo-tests.ts
│   └── run-promptfoo.ts
├── generated/          # auto-generated; do not edit
├── .env.example
└── README.md
```

| Layer | Role |
|-------|------|
| `evaluation-service` | Source of truth for cases, multi-turn chat replay, and deterministic checks |
| `evals/promptfoo` | Optional Promptfoo orchestration: compare runs, LLM-as-judge, regression dashboards |

## Prerequisites

1. Dev stack running (`npm run dev` from repo root) — at least evaluation-service, chat-service, chat-worker, Mongo, LiteLLM.
2. Evaluation cases seeded:

```bash
cd evaluation-service
./scripts/seed-evaluation-cases.sh
```

3. Install Promptfoo package deps (once):

```bash
npm --prefix evals/promptfoo install
```

4. Copy env placeholders and adjust:

```bash
cp evals/promptfoo/.env.example evals/promptfoo/.env
```

## How tests are generated (no duplicated dataset)

Fixtures live only in [`evaluation-service/fixtures/evaluation-cases`](../../evaluation-service/fixtures/evaluation-cases).

```bash
# From repo root
npm run eval:promptfoo:update

# Or from this package
npm run update
```

This writes `generated/tests.yaml` with:

- conversation `messages`
- `expected` mode / structured fields
- rubric summary derived from expected checks
- test `description` (= case id)
- tags (guided, near-term, dreamjob, safety, …)
- deterministic `file://` assertions
- optional `llm-rubric` assertions when `PROMPTFOO_ENABLE_JUDGE=true`

Re-run `update` whenever fixtures change. Do not hand-edit `generated/`.

## Run evaluations

```bash
# Generate (if needed) then evaluate
npm run eval:promptfoo:update
npm run eval:promptfoo
```

View the Promptfoo UI:

```bash
npm run eval:promptfoo:view
```

Results are also written to `evals/promptfoo/output/promptfoo-results.json`.

### Notes on full-suite runs

- Keep `PROMPTFOO_MAX_CONCURRENCY=1` (default). Cases share `EVALUATION_USER_ID` and chat rate limits.
- A full 28-case run can hit the daily chat token budget; failures that say `Daily chat token budget reached` come from chat-service, not from Promptfoo.
- Assertion failures that mention mode / forbiddenWords / maxLines are the **same** checks as `POST /evaluation-cases/:id/run` — Promptfoo is reporting the evaluation-service result.
- Per-test **token usage** comes from chat-service `llmTokenUsage` for the evaluation user during that run window (prompt / completion / total). Visible in Promptfoo’s Tokens column and in result `metadata.tokenUsage`. Accurate when concurrency is 1.

## Compare models / prompts / configs

Because prompts and models live inside chat-service (via LiteLLM), comparison uses **two stacks**:

1. Baseline: current production-like chat-service + evaluation-service (`EVALUATION_SERVICE_BASE_URL`).
2. Candidate: a second chat-service started with a different `LITELLM_MODEL` or prompt revision, plus an evaluation-service pointed at it (`CANDIDATE_EVALUATION_SERVICE_BASE_URL`).

Then:

```bash
npm run eval:promptfoo:compare
```

That uses [`promptfooconfig.compare.ts`](./promptfooconfig.compare.ts) and runs the same generated tests against both providers.

## Environment variables

| Variable | Purpose |
|----------|---------|
| `EVALUATION_SERVICE_BASE_URL` | Baseline evaluation-service URL |
| `CANDIDATE_EVALUATION_SERVICE_BASE_URL` | Candidate evaluation-service for compare runs |
| `PROMPTFOO_JUDGE_PROVIDER` | Judge provider id (e.g. `openai`, `anthropic`) |
| `PROMPTFOO_JUDGE_MODEL` | Judge model name |
| `PROMPTFOO_ENABLE_JUDGE` | Include `llm-rubric` asserts when generating tests |
| `PROMPTFOO_PASS_THRESHOLD` | Minimum pass rate (0–1) |
| `PROMPTFOO_MAX_CONCURRENCY` | Parallel cases (keep low; shared eval user) |
| `PROMPTFOO_TIMEOUT_MS` | Per-case timeout |

Provider API keys for the judge (`OPENAI_API_KEY`, etc.) belong in your local `.env` only — never commit them.

## Deterministic assertions

Implemented in [`assertions/custom-assertions.ts`](./assertions/custom-assertions.ts):

| Assertion | Behavior |
|-----------|----------|
| `assertValidRunResult` | Run result metadata present |
| `assertExistingChecksPassed` | Reuses evaluation-service checks (`mode`, `maxLines`, `mustAskQuestion`, `forbiddenWords`) |
| `assertExpectedMode` | Mode / classification match |
| `assertRequiredExpectedFields` | At least one expected check field |
| `assertForbiddenWordsAbsent` | Forbidden phrases absent |
| `assertNoInternalIds` | No ObjectIds / UUIDs in the reply |
| `assertNoJobsWhenModeDisallows` | No jobs when mode is GUIDED / DREAMJOB |

These wrap the existing evaluation-service scoring rather than reimplementing business logic. The custom provider calls `POST /evaluation-cases/:id/run`, so multi-turn replay and checks run server-side as today.

To add another deterministic assert:

1. Export a `(output, context) => GradingResult` function from `assertions/custom-assertions.ts`.
2. Register it in `DETERMINISTIC_ASSERTIONS` inside `scripts/generate-promptfoo-tests.ts`.
3. Re-run `npm run eval:promptfoo:update`.

## LLM-as-a-judge (rubric) assertions

1. Set `PROMPTFOO_ENABLE_JUDGE=true` and configure `PROMPTFOO_JUDGE_PROVIDER` / `PROMPTFOO_JUDGE_MODEL` (plus the provider API key).
2. Re-generate tests: `npm run eval:promptfoo:update`.
3. Run: `npm run eval:promptfoo`.

Generated rubrics cover relevance, instruction following, one focused question, avoiding repetition, conversation progress, and grounded recommendations.

To add a rubric, append an `{ type: "llm-rubric", value: "...", threshold: 0.7 }` entry to `LLM_RUBRIC_ASSERTIONS` in the generator and re-run `update`.

## Architecture

```text
fixtures/*.json  --generate-->  generated/tests.yaml
                                      |
                                      v
                               promptfoo eval
                                      |
                         evaluation-provider.ts
                                      |
                    POST /evaluation-cases/:id/run
                                      |
                              evaluation-service
                         (multi-turn + evaluateAssistantReply)
                                      |
                                 chat-service
```

## Removal

Delete `evals/` and the `eval:promptfoo*` scripts from the root `package.json`. Nothing in production depends on this package.

## Exact commands (cheat sheet)

```bash
npm --prefix evals/promptfoo install
cp evals/promptfoo/.env.example evals/promptfoo/.env
./evaluation-service/scripts/seed-evaluation-cases.sh
npm run eval:promptfoo:update
npm run eval:promptfoo
npm run eval:promptfoo:view
npm run eval:promptfoo:compare   # optional A/B
```
