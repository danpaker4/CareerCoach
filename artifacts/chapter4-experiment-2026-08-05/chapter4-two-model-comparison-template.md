# 4. Results and Analysis

> ACADEMIC-INTEGRITY NOTE: This is a two-model comparison template, not a completed results chapter. Values marked `MEASURED VALUE REQUIRED` must be replaced with outputs from actual experiments before submission. Do not remove this note while the fields remain unmeasured.

## 4.1. Experimental Setup

The evaluation compares two language-model configurations connected to the same CareerCoach pipeline through LiteLLM. The local configuration uses the Ollama model `careercoach-chat:latest`, while the cloud configuration uses Gemini 2.5 Flash. Model selection is controlled through configuration; the conversation logic, prompts, retrieval stages, database, and evaluation criteria remain unchanged between configurations.

Both configurations are evaluated with the same 36 scripted conversation cases. The suite covers all six supported modes: GUIDED, NEAR_TERM, DREAMJOB, CV_IMPROVE, INTERVIEW_PREP, and SKILLS_GAP. Each case defines an expected mode and behavioural requirements, including maximum response length, required follow-up questions where applicable, and forbidden expressions. A case passes only if every applicable check passes.

Because language-model output is nondeterministic, each of the 36 cases is executed three times per model. This produces 108 evaluated conversations for each configuration and 216 conversations overall. Runs are executed sequentially to reduce interference between concurrent requests. Each case uses isolated user state and a new conversation so that information learned in one case cannot influence another.

The primary measurements are full-case pass rate, mode-detection accuracy, end-to-end latency, and token usage. Results are reported both as totals and by conversation mode. Median and 95th-percentile latency are used because generation latency is not normally distributed. The evaluation also records transport errors and provider-limit errors separately from behavioural failures.

The experiments run on a development machine equipped with a 12th Generation Intel Core i7-12700H processor, 31.7 GB of RAM, and Windows 11 Pro, build 22631. The supporting infrastructure runs in Docker and includes MongoDB Community Edition, MongoDB Community Search, RabbitMQ, LiteLLM, Ollama, Jaeger, OpenTelemetry Collector, and the CareerCoach services.

The evaluated job corpus contains 345 records. All records contain 3,072-dimensional embeddings, and the MongoDB vector-search index uses cosine similarity. The same corpus snapshot is used for both model configurations.

## 4.2. Presentation of Results

### 4.2.1. Overall Conversational Results

Table 4.1 presents the aggregate results across three complete repetitions of the 36-case suite.

| Configuration | Evaluated conversations | Full passes | Pass rate | Correct modes | Mode accuracy | Transport errors |
|---|---:|---:|---:|---:|---:|---:|
| Ollama `careercoach-chat` | 108 | MEASURED VALUE REQUIRED | MEASURED VALUE REQUIRED | MEASURED VALUE REQUIRED | MEASURED VALUE REQUIRED | MEASURED VALUE REQUIRED |
| Gemini 2.5 Flash | 108 | MEASURED VALUE REQUIRED | MEASURED VALUE REQUIRED | MEASURED VALUE REQUIRED | MEASURED VALUE REQUIRED | MEASURED VALUE REQUIRED |

The comparison should be interpreted using the mean result across the three repetitions rather than selecting the strongest individual run. The variation between repetitions should also be reported to show the stability of each model.

Table 4.2. Results by repetition

| Model | Run | Cases passed | Pass rate | Mode accuracy | Median latency | Total tokens |
|---|---:|---:|---:|---:|---:|---:|
| Ollama | 1 | 22/36 | 61.1% | 77.8% | 58.967 s | 38,836 |
| Ollama | 2 | MEASURED VALUE REQUIRED | MEASURED VALUE REQUIRED | MEASURED VALUE REQUIRED | MEASURED VALUE REQUIRED | MEASURED VALUE REQUIRED |
| Ollama | 3 | MEASURED VALUE REQUIRED | MEASURED VALUE REQUIRED | MEASURED VALUE REQUIRED | MEASURED VALUE REQUIRED | MEASURED VALUE REQUIRED |
| Gemini 2.5 Flash | 1 | MEASURED VALUE REQUIRED | MEASURED VALUE REQUIRED | MEASURED VALUE REQUIRED | MEASURED VALUE REQUIRED | MEASURED VALUE REQUIRED |
| Gemini 2.5 Flash | 2 | MEASURED VALUE REQUIRED | MEASURED VALUE REQUIRED | MEASURED VALUE REQUIRED | MEASURED VALUE REQUIRED | MEASURED VALUE REQUIRED |
| Gemini 2.5 Flash | 3 | MEASURED VALUE REQUIRED | MEASURED VALUE REQUIRED | MEASURED VALUE REQUIRED | MEASURED VALUE REQUIRED | MEASURED VALUE REQUIRED |

Only the first Ollama row contains verified measurements from the completed experiment. It must not be used as the three-run aggregate.

### 4.2.2. Behavioural Checks

The full-case pass rate should be supplemented with the result of each individual check. This distinction identifies whether failures are caused primarily by routing, response structure, excessive length, or unsafe wording.

Table 4.3. Behavioural-check accuracy across 108 conversations per model

| Check | Ollama | Gemini 2.5 Flash |
|---|---:|---:|
| Correct conversation mode | MEASURED VALUE REQUIRED | MEASURED VALUE REQUIRED |
| Maximum response length | MEASURED VALUE REQUIRED | MEASURED VALUE REQUIRED |
| Required follow-up question | MEASURED VALUE REQUIRED | MEASURED VALUE REQUIRED |
| Forbidden-expression avoidance | MEASURED VALUE REQUIRED | MEASURED VALUE REQUIRED |

The analysis should identify the most frequent failure category for each model and determine whether the two configurations fail on the same cases. A model may have a similar aggregate pass rate while exhibiting a different error pattern.

### 4.2.3. Mode-Detection Accuracy

Table 4.4. Mode accuracy by expected mode

| Expected mode | Cases per run | Ollama accuracy | Gemini accuracy | Most frequent confusion |
|---|---:|---:|---:|---|
| GUIDED | 21 | MEASURED VALUE REQUIRED | MEASURED VALUE REQUIRED | MEASURED VALUE REQUIRED |
| NEAR_TERM | 8 | MEASURED VALUE REQUIRED | MEASURED VALUE REQUIRED | MEASURED VALUE REQUIRED |
| DREAMJOB | 2 | MEASURED VALUE REQUIRED | MEASURED VALUE REQUIRED | MEASURED VALUE REQUIRED |
| CV_IMPROVE | 2 | MEASURED VALUE REQUIRED | MEASURED VALUE REQUIRED | MEASURED VALUE REQUIRED |
| INTERVIEW_PREP | 2 | MEASURED VALUE REQUIRED | MEASURED VALUE REQUIRED | MEASURED VALUE REQUIRED |
| SKILLS_GAP | 1 | MEASURED VALUE REQUIRED | MEASURED VALUE REQUIRED | MEASURED VALUE REQUIRED |

The mode-level results are particularly important because the suite is imbalanced: 21 of the 36 cases expect GUIDED mode, whereas only one expects SKILLS_GAP mode. Overall accuracy should therefore be presented together with the per-mode results rather than used alone.

### 4.2.4. Latency

Table 4.5. End-to-end latency

| Configuration | Mean | Median | p95 | Minimum | Maximum |
|---|---:|---:|---:|---:|---:|
| Ollama `careercoach-chat` | MEASURED VALUE REQUIRED | MEASURED VALUE REQUIRED | MEASURED VALUE REQUIRED | MEASURED VALUE REQUIRED | MEASURED VALUE REQUIRED |
| Gemini 2.5 Flash | MEASURED VALUE REQUIRED | MEASURED VALUE REQUIRED | MEASURED VALUE REQUIRED | MEASURED VALUE REQUIRED | MEASURED VALUE REQUIRED |

Latency must be measured around the complete asynchronous operation, beginning when the evaluation service submits the user message and ending when the request reaches the completed state. Multi-turn cases should retain the cost of replaying their preceding user turns because that cost is part of the actual evaluation workflow.

For reference, the verified first Ollama run had a mean latency of 69.230 seconds, a median of 58.967 seconds, a p95 of 140.935 seconds, a minimum of 28.498 seconds, and a maximum of 180.075 seconds.

### 4.2.5. Token Usage

Table 4.6. Token usage across three runs

| Configuration | Prompt tokens | Completion tokens | Total tokens | Mean per case | Median per case |
|---|---:|---:|---:|---:|---:|
| Ollama `careercoach-chat` | MEASURED VALUE REQUIRED | MEASURED VALUE REQUIRED | MEASURED VALUE REQUIRED | MEASURED VALUE REQUIRED | MEASURED VALUE REQUIRED |
| Gemini 2.5 Flash | MEASURED VALUE REQUIRED | MEASURED VALUE REQUIRED | MEASURED VALUE REQUIRED | MEASURED VALUE REQUIRED | MEASURED VALUE REQUIRED |

Token usage should also be grouped by expected conversation mode. This reveals whether complex guidance, dream-job planning, or job-search cases consume substantially more context than short quick-help interactions.

The verified first Ollama run used 32,924 prompt tokens and 5,912 completion tokens, for a total of 38,836 tokens across 74 model requests. Mean usage was 1,078.8 tokens per case, and median usage was 905 tokens per case.

### 4.2.6. Grounding and Retrieval

The model comparison should use the same retrieval results for both configurations because job search is performed by the shared CareerCoach retrieval pipeline. The completed grounding audit examined 19 job cards representing six unique corpus records. Every card referred to an existing job identifier, and all checked title, company, seniority, description, URL, salary, and requirements fields matched their database source.

In the 20-query source-document recovery experiment, semantic retrieval achieved Hit@1 of 25%, Hit@5 of 45%, Hit@10 of 65%, and a mean reciprocal rank of 0.370. The title-only fallback did not recover a source document in the first ten results because the queries contained requirements rather than job-title keywords. Median semantic-endpoint latency was 548 ms, while direct MongoDB vector search had a median latency of 29.0 ms over 50 measured queries.

## 4.3. Data Analysis and Interpretation

The completed two-model analysis should answer four questions.

First, which configuration is more reliable? This conclusion should be based on the three-run full-case pass rate and its variation. A higher mean with high run-to-run variation may be less operationally reliable than a slightly lower but stable result.

Second, where does each model fail? The comparison should distinguish mode-routing failures from response-format failures. The verified first Ollama run showed a clear routing weakness: only 2 of 8 NEAR_TERM cases were recognized correctly, while 20 of 21 GUIDED cases were correct. The same per-mode analysis is required for all additional runs before determining whether this pattern is stable or model-specific.

Third, what is the performance cost of improved output quality? The comparison should relate pass rate to median latency and token consumption. A cloud model that is more accurate but more expensive may be appropriate for long-form generation, while the local model may remain preferable for privacy-sensitive or inexpensive classification stages. This conclusion must follow the measured values rather than be assumed from the model provider.

Fourth, which findings belong to the model and which belong to the architecture? Grounding and retrieval are primarily properties of the shared pipeline. Model choice can affect the explanation and selection decision, but structured job cards remain constrained by retrieved database records. The model comparison should therefore avoid attributing the verified grounding result solely to either Ollama or Gemini.

## 4.4. Comparison with Existing Approaches

CareerCoach differs from a general-purpose chatbot by combining a persisted user profile, explicit conversation modes, a controlled job corpus, semantic retrieval, and structured job presentation. The comparison between Ollama and Gemini evaluates model behaviour inside this shared architecture rather than comparing two standalone chat products.

The local configuration prioritizes local execution and control over data processing. The cloud configuration is expected to offer different latency and generation-quality characteristics. Their practical trade-off must be evaluated using the same prompts, cases, corpus, and pass criteria. Cost should be calculated from the measured cloud token usage and the provider pricing applicable on the experiment date; it must not be estimated from undocumented assumptions.

The retrieval experiment also shows why CareerCoach cannot be evaluated solely as a language model. Semantic retrieval recovered 65% of source documents within the top ten when the queries used requirement language, whereas the title-only fallback recovered none. This retrieval behaviour is shared by both model configurations and contributes directly to the quality of their final recommendations.

## 4.5. Discussion of Findings

The final discussion should state whether one model was consistently stronger, whether the quality difference justified its latency and cost, and whether a hybrid routing policy is supported by the results. A defensible hybrid conclusion requires evidence that the local model performs adequately on narrow decisions while the cloud model performs better on generation-heavy cases. That conclusion must not be written until the per-stage or per-mode results demonstrate it.

The comparison should also acknowledge threats to validity. These include the use of one machine, a 345-job snapshot, a limited number of cases in the less frequent modes, and only three repetitions per case. Isolated users should be used to prevent profile state from leaking between cases. Provider throttling, retries, and failed requests should be reported independently from behavioural correctness.

Once all measured fields have been populated, the final conclusion can recommend one of three deployment strategies: local-only execution, cloud-only execution, or hybrid routing. The recommendation should be derived from the measured balance of correctness, mode accuracy, latency, token usage, privacy, and operational reliability.

## Calculation Rules

- Full-case pass rate = cases passing every applicable check / completed cases.
- Mode accuracy = cases with observed mode equal to expected mode / completed cases with an expected mode.
- Mean latency = sum of end-to-end durations / completed cases.
- Median latency = 50th percentile of end-to-end durations.
- p95 latency = 95th percentile of end-to-end durations.
- Mean tokens per case = total recorded tokens / completed cases.
- Transport and provider errors must not be silently removed; report them separately from behavioural failures.
