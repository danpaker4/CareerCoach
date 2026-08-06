# CareerCoach: Example Two-Model Results and Analysis

> **SIMULATED DEMONSTRATION REPORT**
>
> All comparative results in this document are fictional, illustrative, and internally consistent. They demonstrate how a completed comparison between Ollama and Gemini 2.5 Flash could be written. The reported measurements were not produced by executed experiments and must not be presented as real empirical or academic evidence.

## 4. Results and Analysis

### 4.1. Experimental Setup

The simulated evaluation examined the operation of CareerCoach with two language-model configurations. The first configuration used the locally hosted Ollama model `careercoach-chat:latest`. The second used Gemini 2.5 Flash as a cloud-based model. Both models were accessed through LiteLLM and operated within the same CareerCoach pipeline. The prompts, conversation logic, retrieval process, job corpus, validation rules, and supporting services remained unchanged. Therefore, the comparison was designed to isolate the effect of model selection on conversational behaviour and response time.

The evaluation suite contained 36 scripted conversations covering all six CareerCoach modes: GUIDED, NEAR_TERM, DREAMJOB, CV_IMPROVE, INTERVIEW_PREP, and SKILLS_GAP. The suite included both single-turn requests and longer conversations in which earlier messages influenced later decisions. Each case specified the expected mode and basic behavioural requirements, including a maximum response length, avoidance of forbidden expressions, and the inclusion of a follow-up question when further information was required.

Because language-model output can vary between executions, every conversation was simulated three times with each configuration. This produced 108 evaluated conversations per model and 216 conversations in total. A separate synthetic user and a new conversation were used for each case to prevent information from one scenario from affecting another. The two configurations used the same fixed corpus of 345 job records and the same vector-search index.

The simulated environment represented a development computer equipped with a 12th Generation Intel Core i7-12700H processor, 31.7 GB of RAM, and Windows 11 Pro. The supporting stack included Docker, MongoDB Community Edition, MongoDB Community Search, RabbitMQ, LiteLLM, Ollama, Jaeger, OpenTelemetry Collector, MinIO, and the CareerCoach services.

The main evaluation criteria were conversational pass rate, mode-detection accuracy, end-to-end latency, token usage, structured job grounding, and retrieval quality. A conversation passed only when it satisfied every applicable behavioural requirement.

CareerCoach also includes integrations with Promptfoo and Langfuse. Promptfoo provides an external interface for executing and presenting structured evaluation cases, while Langfuse supports observability by displaying model calls, traces, timing information, and usage metadata. In the evaluation workflow represented by this report, the scripted conversations are executed by CareerCoach's internal evaluation service. For every model call, the chat service reads the prompt-token, completion-token, and total-token values returned in the model response and stores them in MongoDB's `llmTokenUsage` collection. The evaluation service then aggregates the records associated with the evaluation user and experiment time window. Promptfoo and Langfuse support evaluation, inspection, and trace analysis, but they are not treated as the original source of the aggregate token totals reported in the results.

### 4.2. Presentation of Results

Both simulated configurations completed all 108 conversations without transport or queue failures. Gemini 2.5 Flash produced the stronger overall conversational result, passing 101 conversations, compared with 88 for Ollama. Gemini also selected the expected conversation mode in 105 cases, while Ollama selected it correctly in 99 cases.

Table 4.1. Simulated comparison of Ollama and Gemini 2.5 Flash

| Configuration | Complete passes | Mode accuracy | Median latency | Total token usage |
|---|---:|---:|---:|---:|
| Ollama `careercoach-chat` | 88/108 (81.5%) | 99/108 (91.7%) | 52.4 seconds | 117,200 |
| Gemini 2.5 Flash | 101/108 (93.5%) | 105/108 (97.2%) | 4.8 seconds | 126,900 |

The difference between the two configurations was most visible in conversations requiring the system to decide whether to continue guided career discovery or begin an immediate job search. Ollama occasionally retained GUIDED mode after the user had explicitly requested current vacancies. Gemini handled these transitions more consistently and produced fewer responses that exceeded the requested length or omitted a necessary follow-up question.

Both configurations avoided the forbidden expressions defined by the evaluation suite in every simulated conversation. Ollama therefore demonstrated reliable basic instruction compliance even though its overall pass rate was lower. Its remaining errors were concentrated mainly in mode selection and conversational structure rather than unsafe or unsupported wording.

The largest performance difference concerned response time. The simulated median end-to-end latency was 52.4 seconds for Ollama and 4.8 seconds for Gemini 2.5 Flash. The local model therefore offered private and locally controlled execution, but its generation speed was less suitable for a fluid interactive conversation on the evaluated development machine. Gemini used approximately 8.3% more tokens, primarily because it produced somewhat longer explanations and follow-up guidance.

#### 4.2.1. Grounding and Retrieval

The simulated grounding audit examined 57 structured job cards produced during the repeated conversations. Every audited card referred to an existing record in the CareerCoach job corpus, and the displayed title, company, seniority, description, URL, salary, and requirements matched the stored source record. Both model configurations therefore achieved complete structured job-card grounding in the demonstration.

This result was mainly a property of the CareerCoach architecture rather than of either language model. The model participated in mode selection and natural-language explanation, while the presentation stage constructed structured job cards from records returned by the database. Consequently, changing the language model affected the wording and conversational decisions without allowing either model to create an unsupported structured vacancy.

A separate simulated retrieval comparison used 20 queries derived from requirements contained in stored job records. Semantic retrieval returned the expected source job among the first ten results for 17 queries. The title-only fallback returned the source job among the first ten results for one query. This difference illustrates the value of semantic retrieval when a user's description of capabilities does not contain the exact title used in a job advertisement. Nevertheless, three semantic queries still failed to retrieve the expected record among the first ten results, showing that grounded recommendations are not automatically the most relevant or best-ranked recommendations.

#### 4.2.2. Resilience and Operational Behaviour

The simulated resilience scenarios examined interruption of a chat worker, loss of the local model, and enforcement of gateway rate limits. When the active worker was interrupted, RabbitMQ retained the unacknowledged request and allowed a replacement worker to complete it. When Ollama was unavailable, five simulated requests were routed to Gemini 2.5 Flash through the configured fallback, and all five completed without requiring changes to the application code. During the rate-limit scenario, excess requests were rejected before they entered the queue or consumed model tokens.

These results illustrate the roles of the main infrastructure components. RabbitMQ protects queued work, LiteLLM separates the application from a specific model provider, and gateway rate limiting protects processing capacity and model usage. Together, these mechanisms support more reliable operation than direct synchronous communication with a single model endpoint.

### 4.3. Data Analysis and Interpretation

Three main findings emerge from the simulated results.

First, Gemini 2.5 Flash provided better conversational consistency. Its full-case pass rate was 12 percentage points higher than that of Ollama, and its mode accuracy was 5.5 percentage points higher. The difference was not caused by transport failures, because both configurations completed every request. Instead, it reflected differences in model behaviour, particularly when interpreting ambiguous intent and maintaining the required response structure.

Second, Ollama remained a viable local option for narrower interactions. It correctly selected the expected mode in more than nine out of ten simulated conversations and avoided forbidden expressions in every case. Local execution also provides advantages that are not represented by pass rate alone, including greater control over data processing, continued availability without an external model provider, and the absence of per-request provider charges. Its principal weaknesses were slower response generation and less reliable handling of transitions into immediate job search.

Third, grounding and retrieval quality must be treated as separate properties. The structured grounding audit contained no unsupported job cards because displayed vacancies were created from database records. However, semantic retrieval recovered the expected source record within the first ten results in 85% of the simulated queries rather than 100%. CareerCoach can therefore prevent fabricated structured vacancies while still returning a real vacancy that is less relevant than another available result. Future improvements should focus on hybrid retrieval, metadata filtering, and reranking rather than treating database grounding as proof of recommendation quality.

The performance results also indicate that language-model generation dominated the user-visible response time. Retrieval took less than one second in the simulated benchmark, whereas the Ollama conversation required approximately one minute at the median. Optimizing the model, prompt size, and number of model calls would consequently provide a greater improvement to response time than optimizing vector search at the current corpus size.

### 4.4. Comparison with Existing Approaches

Compared with a general-purpose chatbot, CareerCoach operates with a persisted career profile, defined conversation modes, and a controlled job corpus. A general chatbot may provide fluent career advice, but it does not automatically know which vacancies exist in the CareerCoach database. CareerCoach's structured presentation stage links each displayed job to a stored source record, reducing the risk of presenting an invented vacancy as a real opportunity.

Compared with a conventional title-based job search, CareerCoach uses semantic retrieval to connect similar meanings expressed with different vocabulary. A user may describe experience as a "backend developer," while an advertisement may request a "server-side software engineer." The simulated retrieval comparison showed that capability-based queries were substantially more effective with semantic retrieval than with the title-only fallback.

Compared with separate resume-analysis, education, and job-search tools, CareerCoach maintains shared context across its features. Information obtained from the user's profile can influence job recommendations, skill-gap analysis, interview preparation, and long-term career planning. The main contribution is therefore the integration of these activities within one conversational workflow rather than the replacement of every specialised external tool.

Compared with a fully managed AI platform, the self-managed CareerCoach components provide control over model routing and local data processing. This control introduces additional operational responsibility, including model hosting, vector-index management, worker supervision, and recovery from failed services. The cloud configuration reduces some performance limitations, while the local configuration preserves privacy and offline capability.

### 4.5. Discussion of Findings

The simulated comparison suggests that both configurations could serve useful roles in CareerCoach. Ollama provides a capable local baseline and is appropriate when privacy, offline operation, or predictable provider cost is the main concern. Gemini 2.5 Flash provides stronger conversational compliance and substantially faster responses, making it more suitable for complex, ambiguous, or generation-heavy interactions.

The most suitable configuration would therefore be a hybrid routing strategy. Narrow decisions, deterministic interactions, and privacy-sensitive requests could be handled locally. Multi-turn career discovery, dream-job planning, detailed roadmap explanations, and difficult intent decisions could be routed to Gemini. LiteLLM already provides the abstraction required to change the selected model without modifying the main conversation pipeline.

The simulated results also identify specific areas for improvement. Explicit phrases such as "show me jobs," "find jobs now," or "skip directly to vacancies" could be handled by deterministic routing rules to reduce confusion between GUIDED and NEAR_TERM modes. Retrieval quality could be strengthened with a combination of semantic and lexical search, followed by metadata filtering or reranking. Worker supervision and stale-request recovery should also be tested under production-like conditions.

Overall, the demonstration illustrates how CareerCoach can combine local and cloud language models within the same grounded, asynchronous architecture. The local model prioritizes control and privacy, while the cloud model prioritizes speed and conversational quality. A hybrid deployment offers the most balanced design, provided that its routing policy is validated through real experiments before any numerical claims are included in an academic submission.
