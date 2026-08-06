# CareerCoach: Simulated Two-Model Results and Analysis

> **SIMULATED DEMONSTRATION REPORT:** The comparative measurements in this document are fictional but internally consistent. They were created to demonstrate how a polished Ollama-versus-Gemini results chapter could look. They are not measurements from executed experiments and must not be represented as empirical or academic evidence.

## 4. Results and Analysis

### 4.1. Evaluation Setup

The simulated evaluation compares two language-model configurations operating through the same CareerCoach processing pipeline. The local configuration uses the Ollama model `careercoach-chat:latest`, while the cloud configuration uses Gemini 2.5 Flash through LiteLLM. Model selection is controlled through configuration, allowing both models to use the same prompts, conversation logic, job corpus, retrieval components, and response-validation rules.

The evaluation suite contains 36 scripted conversation cases covering the six CareerCoach conversation modes. The distribution consists of 21 GUIDED cases, 8 NEAR_TERM cases, 2 DREAMJOB cases, 2 CV_IMPROVE cases, 2 INTERVIEW_PREP cases, and 1 SKILLS_GAP case. Fourteen cases contain multiple user turns. Each case defines an expected conversation mode, a maximum response length, a list of forbidden expressions, and, where appropriate, a requirement that the assistant ask a follow-up question.

Each case is simulated three times for each model configuration to account for nondeterministic language-model output. This produces 108 evaluated conversations per model and 216 conversations overall. Every case uses an isolated synthetic user profile and a new conversation. The two configurations are executed sequentially to avoid competition for processor, memory, database, and queue resources.

The evaluation uses the following measurements:

- Full-case pass rate: the percentage of conversations that pass every applicable check.
- Mode accuracy: the percentage of conversations assigned to the expected conversation mode.
- Instruction compliance: performance on maximum length, required-question, and forbidden-expression checks.
- End-to-end latency: time from message submission until the asynchronous request reaches the completed state.
- Token usage: total prompt and completion tokens recorded by the model-routing layer.
- Grounding: whether presented job cards correspond to records in the CareerCoach database.
- Retrieval quality: the position of a known source document in semantic and title-based retrieval results.

The simulated environment represents a development machine equipped with a 12th Generation Intel Core i7-12700H processor, 31.7 GB of RAM, and Windows 11 Pro. Supporting infrastructure includes Docker, MongoDB Community Edition, MongoDB Community Search, RabbitMQ, LiteLLM, Ollama, Jaeger, OpenTelemetry Collector, MinIO, and the CareerCoach application services.

The job corpus contains 345 records, each with a 3,072-dimensional embedding. The MongoDB vector-search index uses cosine similarity. The same fixed corpus snapshot is used for both model configurations, ensuring that differences in conversational results are attributable to model behaviour rather than different job data.

### 4.2. Overall Results

Both configurations completed all 108 simulated conversations without a transport failure. Gemini 2.5 Flash achieved the stronger overall result, passing 101 of 108 conversations, or 93.5%. The Ollama configuration passed 88 of 108 conversations, or 81.5%. Mode accuracy followed the same pattern: Gemini classified 105 of 108 conversations correctly, while Ollama classified 99.

Table 4.1. Aggregate conversational results

| Configuration | Conversations | Full passes | Pass rate | Correct modes | Mode accuracy | Transport errors |
|---|---:|---:|---:|---:|---:|---:|
| Ollama `careercoach-chat` | 108 | 88 | 81.5% | 99 | 91.7% | 0 |
| Gemini 2.5 Flash | 108 | 101 | 93.5% | 105 | 97.2% | 0 |

The difference of 12.0 percentage points in full-case pass rate indicates that Gemini produced more consistently compliant responses. However, Ollama still passed more than four out of every five conversations and exceeded 90% mode accuracy. This makes the local model a viable option for many routine interactions, particularly when privacy, offline operation, or control over operating costs is important.

### 4.2.1. Stability Across Repetitions

The three repetitions produced similar results for both configurations. Ollama's pass rate varied between 80.6% and 83.3%, while Gemini varied between 91.7% and 94.4%. The narrow range suggests that the aggregate findings were not caused by one unusually strong or weak run.

Table 4.2. Results by repetition

| Model | Run | Cases passed | Pass rate | Mode accuracy | Median latency | Total tokens |
|---|---:|---:|---:|---:|---:|---:|
| Ollama | 1 | 29/36 | 80.6% | 91.7% | 53.1 s | 38,940 |
| Ollama | 2 | 30/36 | 83.3% | 94.4% | 51.8 s | 39,120 |
| Ollama | 3 | 29/36 | 80.6% | 88.9% | 52.4 s | 39,140 |
| Gemini 2.5 Flash | 1 | 34/36 | 94.4% | 97.2% | 4.6 s | 42,200 |
| Gemini 2.5 Flash | 2 | 34/36 | 94.4% | 97.2% | 4.8 s | 42,500 |
| Gemini 2.5 Flash | 3 | 33/36 | 91.7% | 97.2% | 5.0 s | 42,200 |

Gemini's mode accuracy remained unchanged across all three runs. Ollama showed slightly greater variation, particularly in NEAR_TERM and DREAMJOB cases. Nevertheless, its full-case pass rate remained within a 2.7-point range, demonstrating reasonably stable local performance.

### 4.2.2. Behavioural Compliance

Both models performed strongly on response safety and structure. Neither configuration produced a forbidden expression in any of the 108 simulated conversations. Gemini passed the maximum-length check in 107 cases, while Ollama passed in 103. Of the 72 cases per model that required a question, Gemini asked an appropriate follow-up question in 70, compared with 66 for Ollama.

Table 4.3. Behavioural-check results

| Check | Ollama | Gemini 2.5 Flash |
|---|---:|---:|
| Correct conversation mode | 99/108 (91.7%) | 105/108 (97.2%) |
| Maximum response length | 103/108 (95.4%) | 107/108 (99.1%) |
| Required follow-up question | 66/72 (91.7%) | 70/72 (97.2%) |
| Forbidden-expression avoidance | 108/108 (100%) | 108/108 (100%) |

The results indicate that both models followed safety-related constraints reliably. The main difference concerned conversational control. Gemini was more consistent in selecting the intended mode, remaining within the required response length, and ending discovery-oriented answers with an appropriate question.

### 4.2.3. Mode-Detection Results

Table 4.4 presents accuracy by expected conversation mode. Gemini achieved perfect simulated accuracy for GUIDED, INTERVIEW_PREP, and SKILLS_GAP. Its three errors consisted of one NEAR_TERM case classified as GUIDED, one DREAMJOB case classified as NEAR_TERM, and one CV_IMPROVE case classified as GUIDED.

Ollama's strongest result was GUIDED mode, where it classified 61 of 63 conversations correctly. Its largest error group involved NEAR_TERM requests: four of the 24 simulated cases remained in GUIDED mode. This suggests that the local model occasionally preferred continued discovery even when the user requested immediate job results.

Table 4.4. Accuracy by expected conversation mode

| Expected mode | Simulated cases | Ollama | Gemini 2.5 Flash | Most frequent confusion |
|---|---:|---:|---:|---|
| GUIDED | 63 | 61/63 (96.8%) | 63/63 (100%) | GUIDED → NEAR_TERM |
| NEAR_TERM | 24 | 20/24 (83.3%) | 23/24 (95.8%) | NEAR_TERM → GUIDED |
| DREAMJOB | 6 | 5/6 (83.3%) | 5/6 (83.3%) | DREAMJOB → NEAR_TERM |
| CV_IMPROVE | 6 | 6/6 (100%) | 5/6 (83.3%) | CV_IMPROVE → GUIDED |
| INTERVIEW_PREP | 6 | 5/6 (83.3%) | 6/6 (100%) | INTERVIEW_PREP → GUIDED |
| SKILLS_GAP | 3 | 2/3 (66.7%) | 3/3 (100%) | SKILLS_GAP → GUIDED |

The per-mode results are more informative than overall accuracy because the suite contains substantially more GUIDED cases than quick-help cases. The local model's 91.7% aggregate mode accuracy is strong, but the lower SKILLS_GAP and NEAR_TERM results identify areas where deterministic intent rules or more targeted examples could improve routing.

### 4.2.4. Latency

Gemini 2.5 Flash was substantially faster in the simulated comparison. Its median end-to-end latency was 4.8 seconds, compared with 52.4 seconds for Ollama. Gemini's p95 latency remained below nine seconds, whereas Ollama's p95 reached 116.8 seconds.

Table 4.5. End-to-end latency

| Configuration | Mean | Median | p95 | Minimum | Maximum |
|---|---:|---:|---:|---:|---:|
| Ollama `careercoach-chat` | 60.4 s | 52.4 s | 116.8 s | 22.8 s | 168.5 s |
| Gemini 2.5 Flash | 5.1 s | 4.8 s | 8.9 s | 2.3 s | 12.6 s |

The local configuration's longest responses occurred in multi-turn GUIDED and NEAR_TERM cases. These cases replayed previous user turns and required both a model decision and job-processing stages. Gemini's lower latency produced a more responsive interactive experience, while Ollama's slower generation was the main disadvantage of fully local execution.

MongoDB vector search was not a major contributor to either configuration's latency. In the simulated supporting benchmark, direct vector search had a median of 29.0 ms and a p95 of 46.9 ms. The semantic retrieval endpoint, including query embedding and service overhead, had a median of 548 ms. Both values remained small compared with Ollama generation time.

### 4.2.5. Token Usage

Gemini used approximately 8.3% more tokens than Ollama across the simulated comparison. The difference resulted primarily from longer completion outputs. Ollama generated more concise responses, although its shorter answers did not always satisfy the required-question and mode-selection checks.

Table 4.6. Aggregate token usage

| Configuration | Prompt tokens | Completion tokens | Total tokens | Mean per case | Median per case |
|---|---:|---:|---:|---:|---:|
| Ollama `careercoach-chat` | 99,040 | 18,160 | 117,200 | 1,085 | 920 |
| Gemini 2.5 Flash | 104,760 | 22,140 | 126,900 | 1,175 | 1,012 |

Table 4.7. Mean token usage per case by expected mode

| Expected mode | Ollama | Gemini 2.5 Flash |
|---|---:|---:|
| GUIDED | 1,154 | 1,238 |
| NEAR_TERM | 1,016 | 1,104 |
| DREAMJOB | 1,472 | 1,598 |
| CV_IMPROVE | 524 | 571 |
| INTERVIEW_PREP | 958 | 1,046 |
| SKILLS_GAP | 520 | 566 |

DREAMJOB cases consumed the most tokens because they required longer-term reasoning and explanation. CV_IMPROVE and SKILLS_GAP quick-help cases consumed the fewest. The similar distribution across both models indicates that conversation type influenced token usage more strongly than model selection.

### 4.2.6. Grounding and Retrieval

The simulated grounding audit examined 57 job cards produced across the repeated conversations. The cards represented 18 unique corpus records. Every presented identifier existed in the CareerCoach job corpus, and every checked title, company, seniority, description, URL, salary, and requirements field matched its source record. Both configurations therefore achieved 100% structured job-card grounding.

This result follows from the shared pipeline design. The language model can select and explain retrieved jobs, but the presentation stage constructs job cards from database records. Consequently, model choice affected explanation quality and mode selection without allowing either model to create an unsupported structured vacancy.

The simulated retrieval benchmark used 20 source-document queries derived from stored job requirements.

Table 4.8. Retrieval results

| Retrieval method | Hit@1 | Hit@5 | Hit@10 | Mean reciprocal rank | Median latency |
|---|---:|---:|---:|---:|---:|
| Semantic retrieval | 7/20 (35%) | 13/20 (65%) | 17/20 (85%) | 0.493 | 548 ms |
| Title-only fallback | 0/20 (0%) | 1/20 (5%) | 1/20 (5%) | 0.025 | 2 ms |

The queries contained requirement and capability language rather than exact job titles. Semantic retrieval therefore handled the vocabulary difference more effectively than the title-only fallback. Three semantic queries still failed to recover the source record in the top ten, demonstrating that grounding does not guarantee optimal ranking.

### 4.2.7. Resilience

The simulated resilience evaluation covered worker interruption, local-model outage, and gateway rate enforcement.

During the worker-interruption scenario, a request was submitted and the active worker was terminated after processing began. RabbitMQ retained the unacknowledged message. A replacement worker recovered the original request identifier and completed the response without requiring the user to resubmit the message. Median recovery time across three simulations was 18.7 seconds.

During the local-model outage scenario, Ollama was stopped before five synthetic requests were submitted. LiteLLM routed all five requests to Gemini 2.5 Flash. Every request completed successfully, and the provider change was visible in the token-usage and trace records. When Ollama was restarted, subsequent default requests returned to the local route.

During the rate-limit scenario, ten requests were submitted rapidly from one synthetic user. The configured allowance admitted the first two requests and rejected the remaining eight with an HTTP 429 response and retry information. Rejected requests were not placed in RabbitMQ and did not create model token records.

Table 4.9. Resilience results

| Scenario | Attempts | Successful outcome | Result |
|---|---:|---:|---:|
| Worker interruption and recovery | 3 | 3 | 100% |
| Ollama outage with Gemini fallback | 5 | 5 | 100% |
| Excess requests correctly rejected | 8 | 8 | 100% |

## 4.3. Analysis and Interpretation

### 4.3.1. Model Quality

Gemini 2.5 Flash produced the strongest overall simulated result. Its 93.5% full-case pass rate exceeded Ollama's 81.5%, and its 97.2% mode accuracy exceeded Ollama's 91.7%. The cloud model was particularly consistent when deciding whether to continue guided discovery or move into immediate job search.

The difference was smaller on deterministic quick-help interactions than on multi-turn generation. Both models avoided forbidden expressions in every case. Ollama also reached at least 83.3% accuracy in five of the six modes. These results suggest that the local model remained suitable for narrow classification, short coaching prompts, and privacy-sensitive operation, while Gemini provided a quality advantage for complex or ambiguous conversations.

### 4.3.2. Performance and Cost Trade-off

Gemini's principal simulated advantage was speed. Its median latency was approximately 10.9 times lower than Ollama's. This difference materially affects the user experience because a five-second response can support an interactive conversation, whereas a response taking approximately one minute may interrupt the interaction.

Ollama's main advantage is that generation occurs locally and does not create per-request provider charges. Gemini used 9,700 more tokens across the 108 conversations and would incur a variable API cost. A deployment decision should therefore consider both response quality and expected request volume.

A hybrid strategy provides the strongest balance. Deterministic shortcuts and narrow mode decisions can remain local, while complex roadmap explanations, ambiguous intent decisions, and long-form coaching responses can use Gemini. LiteLLM already provides the routing boundary required for this strategy.

### 4.3.3. Grounding and Recommendation Quality

Both model configurations achieved complete structured grounding because job cards were produced from retrieved database records. This eliminates one important form of hallucination: presenting a structured vacancy that does not exist in the corpus.

However, the retrieval benchmark demonstrates that grounding and relevance are different. Semantic retrieval recovered 85% of source records within the first ten results, leaving 15% outside the evaluated range. Improving embeddings, hybrid lexical-semantic ranking, metadata filters, and reranking may therefore improve recommendation quality even when grounding is already perfect.

### 4.3.4. Architectural Resilience

The simulated recovery results support the asynchronous design. RabbitMQ separated request acceptance from generation and preserved work across worker interruption. LiteLLM allowed a provider change without modifying the chat pipeline, and the gateway rejected excess requests before model tokens were consumed.

These mechanisms address different failure classes. RabbitMQ protects in-progress work, LiteLLM protects against model-provider outages, and rate limiting protects system capacity and cost. Their combination is more valuable than any one mechanism in isolation.

## 4.4. Comparison with Alternative Approaches

Compared with a general-purpose chatbot, CareerCoach adds a persistent profile, explicit coaching modes, a controlled job corpus, and structured grounding. A general model can generate career advice, but it does not automatically know which vacancies exist in the CareerCoach database. In the simulated audit, every structured CareerCoach job card matched its database source.

Compared with the title-only fallback, semantic retrieval handled capability-based language more effectively. Semantic search recovered 17 of 20 source jobs within the first ten results, whereas the fallback recovered one. The semantic endpoint was slower, but its 548 ms median remained small relative to model-generation latency.

Compared with separate resume, education, and job-search tools, CareerCoach maintains shared context across features. Skills extracted from the user's profile can inform career direction, job retrieval, skill-gap analysis, interview preparation, and roadmap generation. The value of the system therefore comes from integration as well as from the quality of any individual feature.

Compared with a fully managed AI platform, the self-managed components provide control over data, routing, and local execution. The trade-off is greater operational responsibility. The hybrid configuration reduces this risk by retaining local capability while using a cloud model when higher quality or faster generation is required.

## 4.5. Discussion and Recommended Configuration

The simulated comparison indicates that CareerCoach can operate successfully with either model configuration. Ollama provides a strong local baseline, passing 81.5% of conversations with 91.7% mode accuracy. Gemini provides higher quality and substantially lower latency, passing 93.5% of conversations with 97.2% mode accuracy.

The recommended configuration is hybrid routing. The local model should handle deterministic or narrow interactions, privacy-sensitive requests, and operation during loss of internet access. Gemini should handle ambiguous mode decisions, multi-turn career discovery, dream-job planning, and generation-heavy explanations. This allocation preserves local control while providing a higher-quality interactive experience for difficult conversations.

The most important improvement for the local model is NEAR_TERM detection. Adding deterministic handling for explicit phrases such as “find jobs now,” “show me jobs,” and “skip to jobs” would reduce the largest local confusion without requiring a cloud request. Prompt refinement and additional examples should also improve SKILLS_GAP and DREAMJOB routing.

Retrieval should be improved independently of model routing. Hybrid lexical-semantic search, stronger metadata filtering, and reranking should be evaluated against a larger set of independently judged queries. The simulated 85% Hit@10 result is promising but leaves room for improvement.

Finally, production deployment should retain queue persistence, automated worker supervision, quota-aware provider routing, and gateway rate enforcement. Together, these controls allow CareerCoach to provide grounded, responsive, and resilient career guidance while balancing quality, privacy, latency, and operating cost.
