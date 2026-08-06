4. Results and Analysis

4.1. Experimental Setup

The evaluation was conducted on 5 August 2026 on a single development machine equipped with a 12th Generation Intel Core i7-12700H processor (14 physical cores and 20 logical processors), 31.7 GB of RAM, and Windows 11 Pro, build 22631. Docker Engine 28.3.3 was used to run the supporting infrastructure. Docker had access to 20 logical processors and approximately 16.6 GB of memory. The deployed stack included MongoDB Community Edition 8.2.12, MongoDB Community Search (mongot) 1.70.1, RabbitMQ 3, LiteLLM, Ollama, Jaeger, an OpenTelemetry Collector, MinIO, and the CareerCoach application services.

The job corpus was a fixed snapshot of 345 records stored in the CareerCoach database. The records had creation dates from 27 April to 10 May 2026. All 345 records contained a 3,072-dimensional embedding. The MongoDB vector-search index, jobs_search_embedding_vector_index, used cosine similarity and was in the READY and queryable states before testing began. No live ingestion from TheirStack was performed during this experiment; consequently, the results evaluate the stored snapshot rather than the daily-refresh mechanism.

The conversational evaluation suite contained 36 scripted cases covering all six supported modes: 21 GUIDED cases, 8 NEAR_TERM cases, 2 DREAMJOB cases, 2 CV_IMPROVE cases, 2 INTERVIEW_PREP cases, and 1 SKILLS_GAP case. Fourteen cases contained more than one user turn. Every case specified a maximum response length and a list of forbidden expressions; 24 cases also required the assistant to ask a follow-up question. A case passed only when all checks defined for that case passed. The reported mode accuracy is the proportion of cases in which the observed mode equalled the expected mode.

The evaluated model route used the 4.7 GB Ollama model careercoach-chat:latest (model identifier 22d6ad574cf9) through LiteLLM. A complete 36-case pass was obtained without changing the conversation-pipeline code. The run lasted 2,494.1 seconds, or approximately 41.6 minutes.

The conversational evaluation used one valid synthetic account and created a new conversation for each case. Raw responses, checks, timings, token counts, and errors were saved after every case.

In addition to the end-to-end cases, three deterministic regression suites were executed. The chat-service suite contained 50 tests, the roadmap-service suite contained 36 tests, including three offline roadmap evaluation fixtures, and a selected set of pure job, embedding, vector-search, and career-knowledge tests contained 27 tests across 10 files. A retrieval experiment was also performed on 20 jobs selected deterministically by job identifier. For each selected job, the first three stored requirements were used as a query, and the source job was treated as the target document. This experiment compared semantic retrieval with the system's title-only fallback. It is a source-document recovery test and not a substitute for human relevance judgements.

4.2. Presentation of Results

4.2.1. Deterministic Regression Results

All deterministic tests in the selected suites passed.

Table 4.1. Deterministic test results

| Test suite | Passed | Failed | Result |
|---|---:|---:|---:|
| Chat service | 50 | 0 | 100% |
| Roadmap service | 36 | 0 | 100% |
| Selected job, embedding, and vector tests | 27 | 0 | 100% |
| Total | 113 | 0 | 100% |

These results show that the tested deterministic transformations, contracts, fallback rules, queue-payload parsers, roadmap calculations, and vector utilities behaved as specified. They do not, by themselves, establish the quality of generated language; that question is addressed by the end-to-end evaluation.

4.2.2. Conversational Correctness

The local route completed all 36 cases without a transport or queue failure. Twenty-two cases passed every required check, producing an overall case pass rate of 61.1%. Mode detection was correct in 28 of 36 cases, or 77.8%. The maximum-line check passed in 34 of 36 cases (94.4%), the follow-up-question check passed in 20 of the 24 applicable cases (83.3%), and the forbidden-expression check passed in all 36 cases (100%). The 14 failed cases comprised eight mode errors, four missing-question errors, and two length violations. Each failed case in this run failed one check.

Table 4.2. End-to-end conversation results

| Configuration | Completed cases | Full case passes | Mode accuracy | Median latency | p95 latency | Tokens |
|---|---:|---:|---:|---:|---:|---:|
| Ollama careercoach-chat | 36/36 | 22/36 (61.1%) | 28/36 (77.8%) | 58.967 s | 140.935 s | 38,836 |

The local model's errors were strongly mode-dependent. GUIDED mode was identified correctly in 20 of 21 cases (95.2%). In contrast, only 2 of 8 NEAR_TERM cases were classified correctly (25.0%); the other six were classified as GUIDED. One of the two DREAMJOB cases was classified as NEAR_TERM. The two CV_IMPROVE cases, two INTERVIEW_PREP cases, and single SKILLS_GAP case were classified correctly, although these samples are too small to support a broad statistical conclusion.

Table 4.3. Local mode-confusion results

| Expected mode | Cases | Correct | Accuracy | Observed errors |
|---|---:|---:|---:|---|
| GUIDED | 21 | 20 | 95.2% | 1 classified as NEAR_TERM |
| NEAR_TERM | 8 | 2 | 25.0% | 6 classified as GUIDED |
| DREAMJOB | 2 | 1 | 50.0% | 1 classified as NEAR_TERM |
| CV_IMPROVE | 2 | 2 | 100% | None |
| INTERVIEW_PREP | 2 | 2 | 100% | None |
| SKILLS_GAP | 1 | 1 | 100% | None |

4.2.3. Grounding and Retrieval

The grounding audit examined 19 job cards produced across the local evaluation requests. These cards represented six unique corpus records. Every card referred to an existing job identifier. Furthermore, all 19 cards matched their source record for title, company, seniority, description, URL, salary, and requirements. The audit therefore found zero nonexistent jobs and zero field-level mismatches. This result supports the architectural claim that the presentation stage formats retrieved records rather than allowing the language model to invent job-card data. It does not establish that every retrieved job was relevant to the user.

The separate 20-query source-recovery experiment produced the following results.

Table 4.4. Retrieval source-recovery results

| Retrieval method | Hit@1 | Hit@5 | Hit@10 | Mean reciprocal rank | Median endpoint latency | p95 endpoint latency |
|---|---:|---:|---:|---:|---:|---:|
| Semantic retrieval | 5/20 (25%) | 9/20 (45%) | 13/20 (65%) | 0.370 | 548 ms | 679 ms |
| Title-only fallback | 0/20 (0%) | 0/20 (0%) | 0/20 (0%) | 0.000 | 2 ms | 4 ms |

The queries intentionally contained requirement language in the skills field and no job-title keywords. The zero result for the fallback therefore demonstrates the limitation of this specific title-only fallback when the user's vocabulary describes capabilities rather than a title. It should not be interpreted as a comparison with every possible lexical retrieval algorithm. Semantic retrieval recovered 13 of the 20 source documents within the first ten results, but missed seven; thus, it improved coverage without making retrieval perfect.

To separate database search time from embedding generation and HTTP overhead, the production MongoDB vector pipeline was executed 50 times after five warm-up queries. With numCandidates set to 1,000 and the result limit set to 51, median vector-search latency was 29.0 ms, p95 latency was 46.9 ms, and mean latency was 31.0 ms. The difference between the 29.0 ms database median and the 548 ms semantic-endpoint median indicates that query embedding and service overhead dominated the retrieval endpoint at this corpus size.

4.2.4. Performance and Token Usage

The local end-to-end latency ranged from 28.498 to 180.075 seconds, with a mean of 69.230 seconds, a median of 58.967 seconds, and a p95 of 140.935 seconds. The suite caused 74 local model requests because multi-turn cases replayed each user turn through the pipeline. In total, the local route used 32,924 prompt tokens and 5,912 completion tokens, for 38,836 tokens. Median usage was 905 tokens per evaluation case, and mean usage was 1,078.8 tokens per case.

Table 4.5. Local token usage by expected mode

| Expected mode | Cases | Model requests | Total tokens | Mean tokens per case |
|---|---:|---:|---:|---:|
| GUIDED | 21 | 46 | 24,252 | 1,155 |
| NEAR_TERM | 8 | 16 | 8,161 | 1,020 |
| DREAMJOB | 2 | 5 | 2,937 | 1,469 |
| CV_IMPROVE | 2 | 2 | 1,044 | 522 |
| INTERVIEW_PREP | 2 | 4 | 1,925 | 963 |
| SKILLS_GAP | 1 | 1 | 517 | 517 |

4.2.5. Resilience and Operational Behaviour

The queue-recovery experiment submitted a synthetic request and terminated the local chat worker after the request reached the started state. The request remained stored under the same request identifier. The development watch process did not automatically recreate the terminated execution process, so a replacement worker had to be started explicitly. After the replacement was started, the stale active-request lease delayed reacquisition; the request returned to the started state after 51.7 seconds and reached completed 25.3 seconds later. Completion therefore occurred 77.0 seconds after the replacement worker was launched and 326.3 seconds after the original enqueue time. This confirms persistence and redelivery, while also exposing two operational weaknesses: worker supervision was insufficient in the tested development setup, and stale request leases increased recovery time.

4.3. Data Analysis and Interpretation

Four findings stand out.

First, deterministic correctness and end-to-end conversational correctness differed substantially. All 113 selected deterministic tests passed, but only 61.1% of the local end-to-end cases passed every behavioural check. This is not a contradiction: deterministic tests verify contracts and transformations under controlled inputs, whereas the evaluation suite also tests variable model output. Both levels are necessary. Reporting only the unit-test result would overstate system quality.

Second, the principal local-model weakness was intent routing rather than unsafe wording. The forbidden-expression check passed in every case, and the expected GUIDED mode was recognized in 95.2% of its cases. However, six of eight explicit NEAR_TERM requests were kept in GUIDED mode. This indicates a conservative routing tendency: the model often continued discovery even when the user directly requested jobs. Improving the decision prompt, adding deterministic phrase rules for explicit search requests, or using a stronger classifier for routing would address the largest measured error group. The two excessive-length responses and four missing follow-up questions are secondary but still measurable prompt-compliance issues.

Third, retrieval grounding and retrieval relevance must be treated as separate properties. The grounding audit was perfect for the examined job cards: all identifiers and checked fields matched the database. However, semantic source recovery reached only 65% at rank 10. CareerCoach therefore prevented fabricated structured job cards, but it did not always rank the expected source document highly. Future work should focus on retrieval quality rather than claiming that grounding alone solves recommendation quality.

Fourth, local generation, not vector search, was the dominant measured latency. Direct vector search had a 29.0 ms median, whereas the complete local conversational cases had a 58.967-second median. The semantic retrieval endpoint itself had a 548 ms median because it also generated a query embedding. This supports keeping retrieval self-managed at the current corpus size, while prioritizing model speed, prompt size, and the number of model calls when optimizing user-visible latency.

The recovery experiment also shows that queue persistence alone is only one component of availability. Process supervision and lease recovery are equally important. RabbitMQ preserved the interrupted request, but the system still required explicit worker replacement and waited for a stale lease before processing resumed.

4.4. Comparison with Existing Approaches

Compared with a general-purpose conversational model, CareerCoach adds two project-specific controls: a persisted user-career profile and a defined job corpus. A general model may produce useful career language, but it has no inherent guarantee that a named vacancy exists in the CareerCoach database. In this project, structured job cards were verified against the corpus with zero grounding mismatches in the 19-card audit. This comparison concerns architecture; no controlled head-to-head study with a public chatbot was performed.

Compared with the title-only fallback implemented in CareerCoach, semantic retrieval handled requirement-language queries more effectively. The source job appeared in the top ten for 13 of 20 semantic queries and for none of the title-only queries. The semantic method was slower, with a 548 ms median endpoint latency rather than 2 ms, but the absolute cost remained small relative to local model generation. This experiment compares two implementations inside CareerCoach and should not be generalized to the ranking systems used by commercial job boards.

Compared with separate resume, learning, and job-search tools, CareerCoach's main design advantage is shared context. The same profile, career direction, skill-gap representation, roadmap data, and retrieved jobs can be used across features. The present experiment verified several of the underlying contracts and deterministic roadmap rules, but it did not conduct a user study to determine whether this integration improves long-term career outcomes.

Compared with fully managed AI and vector platforms, the self-managed architecture provides control over model routing and local data processing, but transfers operational responsibility to the project. The measured 29.0 ms median MongoDB vector-search latency shows that self-managed search is technically viable for 345 embedded jobs. At the same time, the manual worker replacement and stale-lease delay demonstrate the operational work that a managed platform may otherwise absorb.

4.5. Discussion of Findings

The experiment supports a qualified conclusion rather than an unreserved claim that all objectives were met. CareerCoach's deterministic components were stable in the selected suites, structured job presentation was grounded in the database, and self-managed vector search was fast at the tested scale. The asynchronous queue also preserved a request across worker interruption. These are meaningful strengths.

However, the local end-to-end pass rate of 61.1% is not yet a production-quality conversational result. The most important corrective action is to improve detection of explicit NEAR_TERM intent, followed by stronger enforcement of follow-up-question and response-length requirements. The measured median local latency of approximately 59 seconds is also too high for a responsive production chat experience. Reducing model calls per turn, shortening prompts, using the local model mainly for narrow classification tasks, or selecting a faster local model should be evaluated before deployment.

Several threats to validity remain. The experiment used one machine, one stored corpus, one synthetic account, and a single complete model pass. Reusing one account may allow profile state from earlier cases to influence later cases, even though every case used a new conversation. The retrieval test used source-document recovery rather than independent human relevance labels. The 20-query sample and 345-job corpus are modest, and the corpus was not refreshed during the experiment. The quick-help modes also had very small samples. These limitations mean that the reported percentages describe this controlled project snapshot and should not be presented as population-level performance.

The next evaluation should therefore use isolated user state per case, multiple random seeds or repeated generations, human relevance judgements, and a larger and freshly ingested multi-provider corpus. Operational testing should add supervised worker restart and cleanup or expiration of stale active-request leases. These changes follow directly from the measured failures and would turn the present evaluation from a useful baseline into a stronger production-readiness study.
