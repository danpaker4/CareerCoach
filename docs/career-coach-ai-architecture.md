# Career Coach — AI Architecture (Staff Engineer)

> מסמך ארכיטקטורה ברמת Senior Staff Engineer.  
> מבוסס על היכולות הרשמיות של Dify / LiteLLM / Langfuse / Promptfoo, ועל מה שקיים בפועל ב־repo של CareerCoach.  
> בכל מקום מצוין במפורש: **Built today** מול **Target / Recommended**.

---

## 0. Truth check — מה קיים היום בפרויקט

לפני הארכיטקטורה הרצויה, המציאות בקוד:

| רכיב | סטטוס | איפה |
|------|--------|------|
| Langfuse (self-hosted) | Built | `docker-compose.yml` — UI `:3100` |
| LiteLLM gateway | Built | `docker-compose.yml` + `litellm-config.yaml` — `:4000` |
| Dify stack | Built (פרויקט compose נפרד) | `dify/docker/` דרך `npm run infra:up` — UI `:8088` |
| chat-service → LiteLLM adapter | Built | `HttpLiteLlmTextCompletionAdapter` |
| chat-service → Dify adapter | Built | `HttpDifyTextCompletionAdapter` |
| Chain `[dify, litellm]` | Built | `buildTextCompletionLlmChain` — Dify ראשון כשיש `DIFY_API_KEY` |
| Langfuse generation tracing | Built | `LangfuseTracedTextCompletionAdapter` + `LangfuseSpanProcessor` |
| promptfoo | Built | `chat-service/promptfoo/` + `npm run eval` |
| Orchestration (stages / mode / dream-job) | **עדיין ב־TypeScript** | `chat-service` — לא בתוך Dify Chatflow |
| job-service / roadmap-service → LiteLLM | Missing | עדיין קוראים ישירות ל־Ollama/Gemini |
| Dify Chatflow + Tools → chat-service APIs | Target | דורש אפליקציית Chatbot ב־UI + API key |

**זרימה אמיתית היום (default):**

```
frontend (/chat)
  → POST chat-service /chat/message  (:3002)
  → RabbitMQ queue chat.message.requests
  → chat-worker (ChatQueueWorker)     ← אותו package: chat-service, process נפרד
  → ChatService (mode / stages / dream-job / prompt builders)
  → TextCompletionPort [litellm]  (+ dify אם DIFY_API_KEY מוגדר)
  → LiteLLM (:4000) → Ollama (:9009) / Gemini
  → parse JSON → MongoDB (conversations, chatRequests, …)
  → publish chat.request.events (queued|started|completed|failed)
  → chat-api consumeEvents → WebSocket (/chat/ws?ticket=…)
  → frontend  (fallback: GET /chat/requests/:requestId)
```

במקביל: spans ל־Langfuse (`:3100`) ו־OTLP→Jaeger אם `OTEL_ENABLED=true`.  
הערה: חבילת `observability` (`gal-observability`) קיימת במונורפו אך chat-service משתמש ב־OTel מקומי תחת `chat-service/src/observability/`.

---

# 1. Architecture Overview

## מהו Career Coach

Career Coach הוא מוצר coaching מקצועי: שיחה רב־הודעתית שמבינה מטרות קריירה, אוספת הקשר (CV / GitHub / achievements), מפעילה כלים פנימיים (חיפוש משרות, roadmap, dream-job), ומחזירה המלצות תוך שמירת state ב־MongoDB.

## רכיבים (שמות אמיתיים בפרויקט)

| שכבה | רכיב | תפקיד |
|------|------|--------|
| UI | `frontend` (:5173) | Chat UI, conversations, roadmaps |
| API | `chat-service` / chat-api (:3002) | HTTP/WS, enqueue, auth מול users-service |
| Worker | `chat-worker` (אותו package, `src/chat-worker.ts`) | צורך RabbitMQ, orchestration + LLM |
| Queue | RabbitMQ (`chat.message.requests` / `chat.request.events`) | decoupling של latency של LLM |
| App LLM layer | Dify (`:8088`, project `careercoach-dify`) | אופציונלי — Chatbot API מעל LiteLLM |
| Model gateway | LiteLLM (`:4000`) | routing / fallback / aliases |
| Observability | Langfuse (`:3100`) + Jaeger (`:16686`) | traces / cost / prompt debug |
| Eval (dev/CI) | promptfoo (+ `evaluation-service` :3004) | regression על prompts / evaluation cases |
| Data | MongoDB `careerCoachDB` (host) | conversations בבעלות chat-service |
| Sibling services | `users-service` :3001, `job-service` :3003, `roadmap-service` :3005 | פרופיל, משרות, roadmaps |

## End-to-end flow (Target עם Dify + LiteLLM)

```
User
  │
  ▼
frontend (React)
  │  POST /chat/...  + WS events
  ▼
chat-api  ──enqueue──► RabbitMQ
  │
  ▼
chat-worker
  │  ChatService: mode detection, stages, dream-job, job search
  │  בונה prompt מלא (או שולח query ל־Dify)
  ▼
TextCompletionPort chain
  │
  ├─► [1] Dify  /v1/chat-messages     (אם DIFY_API_KEY)
  │         │
  │         ▼  (בתוך Dify: Chatflow / Tools / Memory — Target)
  │      LiteLLM  /v1/chat/completions
  │
  └─► [2] LiteLLM ישירות               (fallback / default בלי key)
            │
            ▼
         Ollama / Gemini / ...
            │
            ▼
chat-worker parsers + tools
  │  job-service / roadmap-service / users-service
  │  MongoDB (conversation state)
  ▼
chat.request.events → frontend → User
```

### שלב־שלב

1. **User / frontend** — שולח הודעה; מציג `Queued...` עד שה־worker מסיים.
2. **chat-api** — מאמת, שומר request, דוחף ל־RabbitMQ. לא קורא ל־LLM ב־request path (כדי לא לחסום HTTP).
3. **chat-worker** — היחיד שמריץ `ChatService.sendMessage`. כאן נמצאת הלוגיקה העסקית של השיחה.
4. **Dify** (כשמוגדר) — מקבל את ה־prompt/query; יכול (Target) להריץ Chatflow + Tools. Built today: בעיקר passthrough של completion.
5. **LiteLLM** — נקודת הכניסה היחידה למודלים; aliases כמו `chat-default`.
6. **LLM** — Ollama מקומי / Gemini וכו'.
7. **Backend tools** — חיפוש משרות, עדכון stages, dream-job — ב־chat-worker מול שירותים פנימיים.
8. **MongoDB** — conversation messages, stageProgress, dreamJobFlow.
9. **Response** — events ל־frontend.

---

# 2. Dify

## תפקיד ב־Career Coach

Dify הוא **שכבת אפליקציית LLM** (Chatbot / Chatflow / Workflow / Agent) עם API יציב (`/v1/chat-messages`, `/v1/workflows/run`, …).  
ב־Career Coach הוא יושב **מעל** LiteLLM: chat-worker → Dify → LiteLLM → models.

## למה בכלל צריך אותו

- ניהול גרסאות של prompts / apps בלי deploy של `chat-service`.
- Chatflow ויזואלי לזרימות שאינן קריטיות ל־domain consistency (ניסויים, variants).
- RAG / Knowledge (אם בעתיד יוסיפו knowledge base לקריירה).
- Tool Calling מנוהל ב־UI (חיבור ל־HTTP tools).
- Monitoring מובנה (כולל אינטגרציה ל־Langfuse).

## מה הוא עושה שה־Backend לא חייב לעשות

| Dify | chat-service |
|------|----------------|
| ניסוי prompts / variants | Persistence של conversation ב־Mongo |
| Chatflow ניסויי | Ownership של user identity / auth |
| Knowledge retrieval UI | Transactional consistency עם job/roadmap |
| App-level API keys למשתמשים פנימיים | Queue semantics, retries, idempotency |

## מושגים רשמיים — מיפוי ל־Career Coach

### Chatflow (`advanced-chat`)
גרף שיחה עם nodes (LLM, if/else, knowledge, tools).  
**Target ב־Career Coach:** ניסויי שיחה / variants של “guided discovery”.  
**לא מומלץ כמקור אמת ל־stage machine** שכבר קיים ב־`conversation.stage.consts.ts`.

### Workflow
הרצה חד־פעמית (`/v1/workflows/run`) בלי session chat.  
**מתאים ל:** batch summarization של CV, enrichment חד־פעמי — פחות לשיחת coaching מתמשכת.

### Conversation Variables
משתנים ב־session של Dify (לא Mongo שלנו).  
**שימוש:** הקשר זמני בתוך אפליקציית Dify.  
**State הקנוני של Career Coach** (stages, dreamJobFlow, attachedJobs) חייב להישאר ב־Mongo דרך `chat-service`.

### Tool Calling
Dify יכול לקרוא ל־HTTP tools.  
**Target:** tools שמצביעים ל־`chat-service` / `job-service` **הפנימיים** עם service key — לא לחשוף Mongo ישירות.

### Prompt Management
גרסאות prompt באפליקציה.  
**Built today:** ה־prompts האמיתיים ב־`chat.prompt.utils.ts` + dream-job utils.  
**מומלץ:** או להעביר בהדרגה ל־Dify, או להשאיר ב־TS ולשמור על promptfoo כ־source of truth ל־regression.

### Memory
זיכרון שיחה של Dify (`conversation_id`).  
**Built today:** ה־adapter שלנו **stateless** (בלי `conversation_id`) כי `chat-service` כבר מרכיב history ב־prompt.  
**אם** עוברים ל־Chatflow מלא — צריך מיפוי `Mongo conversationId ↔ Dify conversation_id`.

## למה לא לשים את כל הלוגיקה העסקית ב־Dify

1. **Consistency** — stages / dream-job / job IDs חייבים validation דטרמיניסטי ב־TypeScript (parsers + Zod/hand parsers).
2. **Testability** — unit/integration tests ב־Vitest/tsx על services; Chatflow קשה יותר ל־CI דטרמיניסטי.
3. **Ownership** — RabbitMQ idempotency, token usage Mongo, internal service auth — לא שייכים ל־Dify.
4. **Blast radius** — באג ב־Chatflow לא צריך לשבור persistence.
5. **Multi-service** — roadmap/job/users הם bounded contexts נפרדים.

## APIs רלוונטיים

| API | שימוש ב־Career Coach |
|-----|----------------------|
| `POST /v1/chat-messages` | Built — `HttpDifyTextCompletionAdapter` |
| `POST /v1/completion-messages` | אופציה ל־Text Generator |
| `POST /v1/workflows/run` | Target — משימות חד־פעמיות |
| App parameters / feedback | Target — thumbs up/down → Langfuse scores |

## State של שיחה

| סוג state | איפה היום | איפה צריך להיות |
|-----------|-----------|------------------|
| Messages | Mongo (`Conversation.messages`) | Mongo (source of truth) |
| Stage progress | Mongo (`stageProgress`) | Mongo |
| Dream job flow | Mongo (`dreamJobFlow`) | Mongo |
| Dify conversation_id | לא בשימוש | אופציונלי mapping table |
| Model routing | LiteLLM config | LiteLLM |

## מה מממשים איפה

| ב־Dify | ב־chat-service / siblings |
|--------|---------------------------|
| Prompt experiments | Stage machine |
| Optional RAG | Mode detection rules + parsers |
| Non-critical chat variants | Job search orchestration |
| Human-facing A/B copy | Auth, queue, Mongo writes |
| Tool wrappers ל־HTTP | מימוש ה־endpoints עצמם |

## Best Practices — Dify

1. שמור domain state ב־Mongo, לא רק ב־Dify memory.
2. השתמש ב־Dify כ־app layer מעל LiteLLM, לא כ־DB.
3. כל Tool חייב auth פנימי (`INTERNAL_SERVICE_API_KEY`).
4. אל תעתיק את stage machine ל־Chatflow בלי dual-run.
5. שמור `conversation_id` mapping אם עוברים ל־stateful Dify.
6. Version את האפליקציה; קשר גרסה ל־Langfuse metadata.
7. Blocking mode ל־worker (לא streaming) תואם את ה־queue הנוכחי.
8. Fail open ל־LiteLLM ישיר כש־Dify down (כבר ב־chain).
9. אל תשמור secrets של Gemini ב־Dify — רק מפתח LiteLLM.
10. הגדר Langfuse ב־Monitoring של Dify לאותו פרויקט self-hosted.

---

# 3. LiteLLM

## למה צריך LiteLLM ב־Career Coach

היום יש Ollama מקומי + Gemini אופציונלי + בעתיד עוד ספקים. בלי gateway:

- כל שירות (`chat-service`, `job-service`, `roadmap-service`) מדבר פרוטוקול אחר.
- Fallback מפוזר ב־TypeScript (היה `FallbackTextCompletionAdapter`).
- החלפת מודל = שינוי קוד + redeploy.

LiteLLM הוא **LLM Gateway** OpenAI-compatible: נקודת כניסה אחת (`:4000`).

## יכולות (רשמיות) — שימוש אצלנו

| יכולת | יישום ב־Career Coach |
|--------|----------------------|
| Provider abstraction | `chat-default` → `ollama/llama3` |
| Model aliases | `chat-default`, `chat-fallback` ב־`litellm-config.yaml` |
| Routing / fallback | `fallbacks: chat-default → chat-fallback (gemini)` |
| Retry | הגדרות LiteLLM (לא ב־TS) |
| Rate limits / budgets | Target בפרודקשן |
| Virtual API keys | `LITELLM_MASTER_KEY=sk-litellm-local-dev` |
| Cost tracking | דרך Langfuse callback |
| Load balancing | Target אם כמה replicas של אותו מודל |

## דוגמה: החלפת מודל בלי לגעת ב־Dify / chat-service

```yaml
# litellm-config.yaml — לפני
- model_name: chat-default
  litellm_params:
    model: ollama/llama3

# אחרי — רק כאן משנים
- model_name: chat-default
  litellm_params:
    model: ollama/llama3.1
```

Dify ממשיך לקרוא ל־`chat-default`.  
`HttpLiteLlmTextCompletionAdapter` ממשיך עם `LITELLM_MODEL=chat-default`.  
**אפס שינוי בקוד.**

## למה לא לדבר ישירות עם OpenAI/Gemini/Ollama

1. Contract אחד (`/v1/chat/completions`) לכל הצרכנים.
2. Fallback מרכזי (Ollama כבוי → Gemini).
3. מפתחות ספקים לא מפוזרים ב־env של כל microservice.
4. Observability אחיד (callback ל־Langfuse).
5. אפשרות ל־virtual keys / budgets בפרודקשן.
6. Dify ו־promptfoo ו־chat-service — כולם אותו gateway.

**Best practice:** גם `job-service` / `roadmap-service` צריכים לעבור ל־LiteLLM (כרגע Missing).

---

# 4. Langfuse

## AI Observability ב־Career Coach

Langfuse אוסף **traces** של קריאות LLM: prompt, completion, latency, tokens, cost, metadata (userId, operation).

## מושגים

| מושג | משמעות אצלנו |
|------|----------------|
| Trace | בקשת worker אחת / generation אחת (למשל `chat.decision`) |
| Session | Target — קישור ל־`conversationId` |
| Observation / Generation | `LangfuseTracedTextCompletionAdapter` עם `asType: "generation"` |
| Prompt versions | Target — tag לפי git sha / Dify app version |
| Scores | Target — feedback מה־UI / eval אוטומטי |
| Evaluations | משולב עם promptfoo + scores |
| Human feedback | thumbs על הודעת assistant |
| Metadata | `operation`, `provider`, `userId` |
| Dashboards | UI ב־`:3100` |
| Cost / tokens / latency | מ־LiteLLM callback + SDK |

## מה רואים בשיחה אמיתית

דוגמת Trace (מבוסס על מה שכבר ראינו בפרויקט):

```
Trace: verify.e2e / chat.stage_reply
├─ input:  "<full prompt from buildStagePrompt...>"
├─ output: "{\"reply\":\"...\",\"shouldAdvanceStage\":false}"
├─ model:  chat-default
├─ metadata.provider: litellm
├─ metadata.operation: chat.stage_reply
├─ userId: <user>
├─ latency: ~0.5–8s
└─ usage: prompt_tokens / completion_tokens

Sibling (מ־LiteLLM callback):
Trace: litellm-acompletion
├─ messages: [...]
└─ usage + model routing info
```

בשיחה מלאה של משתמש (Target session view):

```
Session conversationId=...
  Trace chat.decision (mode path)
  Trace chat.stage_reply
  Trace chat.job_aware_reply
  Trace chat.dream_job
```

## Metrics חשובים

1. Latency p50/p95 לפי `operation`
2. Parse fallback rate (JSON שנכשל → fallback reply)
3. Token usage / cost לפי user ולפי model
4. Error rate LiteLLM / Dify / Ollama
5. Fallback activation rate (Ollama → Gemini)
6. Queue wait time (enqueue → worker start) — מ־OTEL/Jaeger
7. Score ממוצע (human feedback)

---

# 5. Promptfoo

## למה צריך

שינוי פסיק ב־prompt יכול לשבור את ה־JSON שה־parsers מצפים לו (`parseLlmDecisionFromJson`, stage, dream-job, mode).  
Promptfoo הוא **evaluation framework** שרץ מול אותו LiteLLM כמו הפרודקשן.

## סוגים

| סוג | שימוש ב־Career Coach |
|-----|----------------------|
| Functional | `is-json` + field asserts — **Built** |
| Conversation | Target — multi-turn fixtures |
| Regression | `npm run eval` אחרי שינוי prompt |
| Red team / security | Target — prompt injection |
| LLM-as-Judge | Target — איכות coaching |
| CI/CD | Target — GitHub Action על eval |

## Tests שקיימים היום

ב־`chat-service/promptfoo/`:

- Decision → `{ reply, shouldSearchJobs, recommendedJobIds, searchFilters }`
- Stage → `{ reply, shouldAdvanceStage }`
- Mode detection → `mode ∈ GUIDED|FAST_SEARCH|DEEP_DISCOVERY|DREAMJOB`
- Dream job → `{ reply, awaitingConfirmation, userConfirmed }`

## Tests שכדאי להוסיף

| תרחיש | Assert |
|--------|--------|
| רוצה להיות Software Architect | mode/dream-job לא קופץ ל־FAST_SEARCH בטעות |
| משנה דעה באמצע | stage לא מתקדם על contradictory signal בלי confirmation |
| מידע חלקי | `shouldSearchJobs=false` עד שיש filters מינימליים |
| Prompt injection (“ignore instructions…”) | עדיין JSON תקין; לא מדליף system prompt |
| Tool abuse (“delete all users”) | לא מחזיר side-effect flags; backend לא מפעיל tools מסוכנים |
| Explicit job search | `mode=FAST_SEARCH` + `fastSearchQuery` |

## איך מונע Regression

1. Prompt builders האמיתיים מיובאים ב־`chat.prompt.ts` — אין כפילות.
2. Asserts משקפים parsers.
3. רץ מול LiteLLM → אותו מודל כמו runtime.
4. כשל ב־eval = לא merge (כשיוגדר ב־CI).

---

# 6. איך כל המערכות מתחברות

## Runtime flow מלא

```
frontend
   │
   ▼
chat-api ──► RabbitMQ ──► chat-worker
                             │
                             ▼
                      ChatService (TS orchestration)
                             │
                             ▼
                   TextCompletionPort chain
                      │              │
                      ▼              ▼
                   Dify (:8088)   LiteLLM (:4000)  ← fallback / default
                      │              │
                      └──────┬───────┘
                             ▼
                    Ollama / Gemini / ...
                             │
                             ▼
                   parsers + internal tools
                      │
          ┌───────────┼───────────┐
          ▼           ▼           ▼
     job-service  roadmap-svc  users-service
          │
          ▼
       MongoDB
          │
          ▼
   events → frontend → User
```

## Parallel paths

```
LiteLLM ──success_callback──► Langfuse
chat-worker SDK spans ──────► Langfuse
chat-worker OTEL ───────────► otel-collector → Jaeger

promptfoo (dev/CI) ──► LiteLLM ──► models
                   (לא בנתיב ה־user)
```

## מה קורה ב־Runtime לכל רכיב

| רכיב | Runtime |
|------|---------|
| frontend | שולח הודעה, מקשיב לאירועים |
| chat-api | מאמת, שולח לתור |
| RabbitMQ | buffering |
| chat-worker | orchestration + LLM + tools + Mongo |
| Dify | completion/app (אם keyed) |
| LiteLLM | model call + fallback + cost callback |
| Langfuse | ingest traces (async) |
| promptfoo | לא רץ ב־request path |

---

# 7. חלוקת אחריות

| Component | Responsibility | Should NOT Do |
|-----------|----------------|---------------|
| **frontend** | UX, שליחת הודעות, הצגת jobs/roadmap | קריאות ישירות ל־LiteLLM/Dify עם secrets |
| **chat-api** | HTTP/WS, auth boundary, enqueue | קריאות LLM סינכרוניות ארוכות |
| **chat-worker** | Orchestration, parsers, tools, Mongo writes | החזקת API keys של OpenAI/Gemini ישירות |
| **Dify** | App/prompt experiments, optional Chatflow/Tools | Source of truth ל־stage/dream-job ב־Mongo |
| **LiteLLM** | Model routing, fallback, aliases, provider keys | Business rules של Career Coach |
| **Langfuse** | Traces, cost, debug, scores | שליטה בזרימת השיחה |
| **promptfoo** | Offline/CI evaluation | Production serving |
| **RabbitMQ** | Async decoupling | Store of conversation truth |
| **MongoDB** | Canonical conversation + usage docs | Model routing |
| **job-service** | Job search / embeddings domain | Chat stage machine |
| **roadmap-service** | Roadmap generation domain | Chat mode detection |
| **users-service** | Profile / CV / auth identity | LLM prompts |
| **Ollama/Gemini** | Inference בלבד | ידע על המשתמש מעבר ל־prompt |

---

# 8. Production Best Practices (30+)

### Security
1. Secrets רק ב־env / secret manager — לא ב־git.
2. `LITELLM_MASTER_KEY` ו־Dify app keys שונים לפי סביבה.
3. Tools של Dify רק עם internal service auth.
4. אל תחשוף Langfuse / LiteLLM / Dify לאינטרנט בלי auth ו־TLS.
5. סנן PII ב־Langfuse אם נדרש (masking / retention policy).
6. הגן מפני prompt injection ב־asserts + server-side validation.

### Reliability & Fallback
7. Chain `[dify, litellm]` עם fail-open.
8. LiteLLM fallback Ollama→Gemini מוגדר ב־config, לא ב־TS.
9. Timeouts ברורים על כל HTTP ל־Dify/LiteLLM.
10. RabbitMQ retries + DLQ לכשלונות worker.
11. Idempotency לטיפול חוזר באותו chat request.

### Observability
12. כל LLM call עם `operation` + `userId`.
13. Langfuse + Jaeger יחד (LLM vs infra).
14. מדוד parse-fallback rate.
15. Alerts על error rate ו־p95 latency.
16. קשר `conversationId` כ־session ב־Langfuse.

### Prompt & Versioning
17. Version prompts (git sha / Dify app version) ב־metadata.
18. שינוי prompt = חובת `npm run eval`.
19. אל תשנה parser ו־prompt באותו PR בלי eval ירוק.
20. Dual-run לפני העברת לוגיקה ל־Dify Chatflow.

### Evaluation
21. Functional asserts על JSON shape.
22. Conversation / injection tests נוספים.
23. LLM-as-judge לדגימות איכות שבועיות.
24. Human feedback → Langfuse scores.

### Performance & Cost
25. Queue מפריד UX מ־LLM latency.
26. Budgets / rate limits ב־LiteLLM בפרודקשן.
27. בחר מודל לפי operation (זול ל־mode detection, חזק ל־dream-job).
28. Cache embeddings בנפרד מ־chat completions.

### Scaling & Deployment
29. Scale `chat-worker` לפי עומק התור, לא את ה־API.
30. LiteLLM ו־Dify כ־services נפרדים עם healthchecks.
31. Infra דרך `npm run infra:up` (שני compose projects).
32. אל תמזג את Dify לתוך אותו compose עם התנגשות שמות (`minio`).

### Data
33. Mongo = source of truth לשיחה.
34. Token usage נשמר גם מקומית (repository) וגם ב־Langfuse.
35. גיבוי ל־ClickHouse/Postgres של Langfuse בפרודקשן.

---

# 9. Common Mistakes (20+)

1. לשים business logic בתוך ה־prompt במקום ב־`ChatService`.
2. לא לעשות validation/parse ב־backend אחרי תשובת LLM.
3. לדלג על regression tests (promptfoo) אחרי שינוי ניסוח.
4. לשמור stage state רק ב־Dify conversation variables.
5. לקרוא ל־OpenAI/Gemini ישירות מ־job-service במקום LiteLLM.
6. לשים `LLM_PROVIDER=dify` בלי LiteLLM מתחת — נעילה לספק אחד דרך Dify.
7. להשתמש ב־`localhost:4000` מתוך קונטיינר Dify במקום `host.docker.internal` / DNS פנימי.
8. לחשוף Dify/Langfuse בלי סיסמה ל־LAN.
9. לא לקשר traces ל־`userId` / `conversationId`.
10. Streaming ב־Dify בזמן שה־worker מצפה ל־blocking JSON.
11. לכפול prompts ב־YAML במקום לייבא מ־`chat.prompt.utils.ts`.
12. להאמין ל־`shouldSearchJobs` בלי לבדוק filters.
13. לערבב secrets של Langfuse init keys בין סביבות.
14. להריץ LLM ב־chat-api (סינכרוני) במקום ב־worker.
15. לשכוח להרים `chat-worker` → הודעות תקועות ב־Queued.
16. Include של Dify לתוך אותו compose עם התנגשות `minio`.
17. להעביר את כל ה־stage machine ל־Chatflow ביום אחד בלי dual-run.
18. לא למדוד parse fallback — שקט של כשלים.
19. Red-team חסר — prompt injection מצליח “לשכנע” את המודל לעקוף JSON.
20. לחשוב ש־promptfoo מחליף unit tests של parsers.
21. Virtual key אחד לכל הסביבות.
22. להתעלם מ־cost ב־Langfuse עד שהחשבון תופח.
23. Memory כפולה (Dify + Mongo) בלי מקור אמת יחיד.
24. Tools ב־Dify שכותבים ל־DB בלי auth ובלי audit.

---

# 10. Final Architecture

```
                         ┌──────────────┐
                         │   frontend   │
                         └──────┬───────┘
                                │ HTTP/WS
                         ┌──────▼───────┐
                         │   chat-api   │
                         └──────┬───────┘
                                │ publish
                         ┌──────▼───────┐
                         │   RabbitMQ   │
                         └──────┬───────┘
                                │ consume
                         ┌──────▼──────────┐
                         │   chat-worker   │◄──── OTEL ────► Jaeger
                         │  ChatService TS │
                         └──────┬──────────┘
                                │ TextCompletionPort
                 ┌──────────────┴──────────────┐
                 ▼                             ▼
          ┌─────────────┐               ┌─────────────┐
          │ Dify :8088  │               │LiteLLM :4000│
          │ Chatbot API │──────────────►│  gateway    │
          └─────────────┘               └──────┬──────┘
                                               │
                                ┌──────────────┼──────────────┐
                                ▼              ▼              ▼
                             Ollama         Gemini         (future)
                             :9009
                                │
                                ▼
                         parsers + tools
                    ┌───────────┼───────────┐
                    ▼           ▼           ▼
              job-service  roadmap-svc  users-service
                    │
                    ▼
                 MongoDB

     Observability:                 Evaluation (offline):
     LiteLLM ──► Langfuse :3100     promptfoo ──► LiteLLM
     chat-worker SDK ──► Langfuse   CI/CD (Target)

     Infra up:  npm run infra:up
       = docker-compose.yml  +  careercoach-dify compose
```

### בקשה אחת של משתמש — סוף־אל־סוף

1. המשתמש שולח “I want to become a software architect” ב־frontend.  
2. `chat-api` שומר request ודוחף ל־RabbitMQ.  
3. `chat-worker` מריץ mode detection → כנראה `GUIDED` / `DREAMJOB` (לא FAST_SEARCH).  
4. נבנה prompt מ־TypeScript (history + account context + achievements).  
5. אם יש `DIFY_API_KEY` — קריאה ל־Dify; אחרת ישר ל־LiteLLM.  
6. LiteLLM מנתב ל־`chat-default` (Ollama) או fallback ל־Gemini.  
7. Langfuse מקבל generation (prompt/output/tokens) + callback מ־LiteLLM.  
8. Parser מוודא JSON; כשל → fallback reply בטוח.  
9. עדכון Mongo (messages / stage / dreamJobFlow); כלי עזר ל־job/roadmap לפי הצורך.  
10. Event ל־frontend — המשתמש רואה תשובה.  
11. ב־PR הבא: `npm run eval` מוודא שה־prompts עדיין מחזירים shape תקין.

---

## Gap closure roadmap (מומלץ)

| עדיפות | פריט |
|--------|------|
| P0 | ליצור Chatbot ב־Dify UI, לחבר ל־LiteLLM, למלא `DIFY_API_KEY` |
| P0 | להריץ `npm run infra:up` כברירת מחדל ל־dev |
| P1 | Sessions ב־Langfuse לפי `conversationId` |
| P1 | העברת job-service/roadmap-service ל־LiteLLM |
| P2 | promptfoo: injection + multi-turn |
| P2 | CI job ל־`npm run eval` |
| P3 | Chatflow dual-run ל־variant אחד של guided chat |

---

*מסמך זה משקף את מצב ה־repo אחרי אינטגרציית LiteLLM / Langfuse / Dify / promptfoo. יש להבחין תמיד בין יכולת מובנית במוצר לבין החלטה ארכיטקטונית של Career Coach.*
