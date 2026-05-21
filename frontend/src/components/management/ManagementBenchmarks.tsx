import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import iconArrowRight from '../../assets/icon-arrow-right.svg';
import { apiFetch } from '../../lib/apiClient';
import {
  ADMIN_BENCHMARKS_PATH,
  MANAGEMENT_BENCHMARK_LOAD_ERROR_MESSAGE,
  MANAGEMENT_BENCHMARK_RUN_ERROR_MESSAGE,
} from './management.consts';
import type {
  BenchmarkCandidateId,
  BenchmarkConfig,
  BenchmarkRunSummary,
  BenchmarkStatus,
} from './management.types';
import {
  buildBenchmarksRunsUrl,
  parseBenchmarkConfig,
  parseBenchmarkRun,
  parseBenchmarkRuns,
  readManagementErrorMessage,
} from './management.utils';
import './Management.css';

const RUN_HISTORY_LIMIT = 10;

const formatPercent = (value: number): string => `${Math.round(value * 100)}%`;

const formatScore = (value: number): string => `${Math.round(value)}`;

const formatLatency = (value: number): string => `${Math.round(value)}ms`;

const formatDateTime = (value: string): string => new Date(value).toLocaleString();

export const ManagementBenchmarks = () => {
  const [status, setStatus] = useState<BenchmarkStatus>('loading');
  const [runStatus, setRunStatus] = useState<'idle' | 'running'>('idle');
  const [error, setError] = useState('');
  const [config, setConfig] = useState<BenchmarkConfig | null>(null);
  const [runs, setRuns] = useState<BenchmarkRunSummary[]>([]);
  const [selectedCaseIds, setSelectedCaseIds] = useState<string[]>([]);
  const [selectedRunId, setSelectedRunId] = useState('');
  const [expandedCandidateIds, setExpandedCandidateIds] = useState<BenchmarkCandidateId[]>([]);
  const [expandedCaseIds, setExpandedCaseIds] = useState<string[]>([]);

  const selectedRun = useMemo(
    () => runs.find((run) => run.id === selectedRunId) ?? runs[0] ?? null,
    [runs, selectedRunId],
  );
  const expandedCandidateResults = useMemo(
    () => selectedRun?.candidateResults.filter((candidate) => expandedCandidateIds.includes(candidate.candidateId)) ?? [],
    [expandedCandidateIds, selectedRun],
  );

  const loadBenchmarks = async (): Promise<void> => {
    setStatus('loading');
    setError('');

    const [configResponse, runsResponse] = await Promise.all([
      apiFetch(`${ADMIN_BENCHMARKS_PATH}/config`),
      apiFetch(buildBenchmarksRunsUrl(RUN_HISTORY_LIMIT)),
    ]);

    if (!configResponse.ok) {
      setStatus('error');
      setError(await readManagementErrorMessage(configResponse, MANAGEMENT_BENCHMARK_LOAD_ERROR_MESSAGE));
      return;
    }

    if (!runsResponse.ok) {
      setStatus('error');
      setError(await readManagementErrorMessage(runsResponse, MANAGEMENT_BENCHMARK_LOAD_ERROR_MESSAGE));
      return;
    }

    const configPayload: unknown = await configResponse.json().catch(() => null);
    const runsPayload: unknown = await runsResponse.json().catch(() => null);
    const parsedConfig = parseBenchmarkConfig(configPayload);
    const parsedRuns = parseBenchmarkRuns(runsPayload);
    if (!parsedConfig || !parsedRuns) {
      setStatus('error');
      setError(MANAGEMENT_BENCHMARK_LOAD_ERROR_MESSAGE);
      return;
    }

    setConfig(parsedConfig);
    setRuns(parsedRuns);
    setSelectedCaseIds(parsedConfig.cases.map((benchmarkCase) => benchmarkCase.id));
    setSelectedRunId(parsedRuns[0]?.id ?? '');
    setStatus('success');
  };

  useEffect(() => {
    loadBenchmarks().catch((loadError: unknown) => {
      setStatus('error');
      setError(loadError instanceof Error ? loadError.message : MANAGEMENT_BENCHMARK_LOAD_ERROR_MESSAGE);
    });
  }, []);

  useEffect(() => {
    setExpandedCandidateIds([]);
    setExpandedCaseIds([]);
  }, [selectedRunId]);

  const handleCaseToggle = (caseId: string): void => {
    setSelectedCaseIds((currentCaseIds) =>
      currentCaseIds.includes(caseId)
        ? currentCaseIds.filter((currentCaseId) => currentCaseId !== caseId)
        : [...currentCaseIds, caseId],
    );
  };

  const toggleCandidateDetails = (candidateId: BenchmarkCandidateId): void => {
    const isCurrentlyExpanded = expandedCandidateIds.includes(candidateId);
    setExpandedCandidateIds((currentCandidateIds) =>
      isCurrentlyExpanded
        ? currentCandidateIds.filter((currentCandidateId) => currentCandidateId !== candidateId)
        : [...currentCandidateIds, candidateId],
    );
    if (isCurrentlyExpanded) {
      setExpandedCaseIds((currentCaseIds) =>
        currentCaseIds.filter((currentCaseId) => !currentCaseId.startsWith(`${candidateId}:`)),
      );
    }
  };

  const buildCaseExpansionId = (candidateId: BenchmarkCandidateId, caseId: string): string => `${candidateId}:${caseId}`;

  const toggleCaseDetails = (candidateId: BenchmarkCandidateId, caseId: string): void => {
    const expansionId = buildCaseExpansionId(candidateId, caseId);
    setExpandedCaseIds((currentCaseIds) =>
      currentCaseIds.includes(expansionId)
        ? currentCaseIds.filter((currentCaseId) => currentCaseId !== expansionId)
        : [...currentCaseIds, expansionId],
    );
  };

  const runBenchmark = async (): Promise<void> => {
    setRunStatus('running');
    setError('');

    const response = await apiFetch(`${ADMIN_BENCHMARKS_PATH}/runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caseIds: selectedCaseIds }),
    });

    if (!response.ok) {
      setRunStatus('idle');
      setError(await readManagementErrorMessage(response, MANAGEMENT_BENCHMARK_RUN_ERROR_MESSAGE));
      return;
    }

    const payload: unknown = await response.json().catch(() => null);
    const parsedRun = parseBenchmarkRun(payload);
    if (!parsedRun) {
      setRunStatus('idle');
      setError(MANAGEMENT_BENCHMARK_RUN_ERROR_MESSAGE);
      return;
    }

    setRuns((currentRuns) => [parsedRun, ...currentRuns.filter((run) => run.id !== parsedRun.id)].slice(0, RUN_HISTORY_LIMIT));
    setSelectedRunId(parsedRun.id);
    setRunStatus('idle');
  };

  return (
    <main className="management-page">
      <section className="management-header">
        <div>
          <p className="management-eyebrow">Benchmarks</p>
          <div className="management-title-row">
            <Link
              to="/management"
              className="management-back-icon-button"
              aria-label="Back to management home"
              title="Management home"
            >
              <img src={iconArrowRight} alt="" aria-hidden="true" className="management-back-icon" />
            </Link>
            <h1>Chat LLM benchmark</h1>
          </div>
          <p className="management-subtitle">Compare Llama/Ollama and Gemini on repeatable chat-flow cases.</p>
        </div>
      </section>

      {error ? <section className="management-alert management-alert--error">{error}</section> : null}

      {status === 'loading' ? (
        <section className="management-state">Loading benchmarks...</section>
      ) : null}

      {status === 'success' && config ? (
        <section className="management-benchmarks">
          <div className="management-benchmark-panel">
            <div className="management-token-usage-header">
              <div>
                <h2>Run benchmark</h2>
                <p className="management-subtitle">Selected cases run against each model without fallback.</p>
              </div>
              <button
                type="button"
                className="btn-primary"
                disabled={runStatus === 'running' || selectedCaseIds.length === 0}
                onClick={() => { runBenchmark().catch(() => setRunStatus('idle')); }}
              >
                {runStatus === 'running' ? 'Running...' : 'Run selected cases'}
              </button>
            </div>

            <div className="management-benchmark-candidates">
              {config.candidates.map((candidate) => (
                <div key={candidate.id} className="management-benchmark-candidate">
                  <span className={`management-benchmark-status ${candidate.available ? 'management-benchmark-status--ok' : 'management-benchmark-status--error'}`}>
                    {candidate.available ? 'Available' : 'Unavailable'}
                  </span>
                  <strong>{candidate.label}</strong>
                  <span>{candidate.provider} / {candidate.model}</span>
                  {candidate.unavailableReason ? <p>{candidate.unavailableReason}</p> : null}
                </div>
              ))}
            </div>

            <div className="management-benchmark-cases" aria-label="Benchmark cases">
              {config.cases.map((benchmarkCase) => (
                <label key={benchmarkCase.id} className="management-benchmark-case">
                  <input
                    type="checkbox"
                    checked={selectedCaseIds.includes(benchmarkCase.id)}
                    onChange={() => handleCaseToggle(benchmarkCase.id)}
                  />
                  <span>
                    <strong>{benchmarkCase.title}</strong>
                    <span>{benchmarkCase.description}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="management-benchmark-panel">
            <div className="management-token-usage-header">
              <div>
                <h2>Latest results</h2>
                <p className="management-subtitle">Overall score is calculated from automatic benchmark metrics.</p>
              </div>
              {runs.length > 0 ? (
                <select
                  className="management-benchmark-select"
                  value={selectedRun?.id ?? ''}
                  onChange={(event) => setSelectedRunId(event.target.value)}
                  aria-label="Select benchmark run"
                >
                  {runs.map((run) => (
                    <option key={run.id} value={run.id}>{formatDateTime(run.createdAt)}</option>
                  ))}
                </select>
              ) : null}
            </div>

            {!selectedRun ? (
              <div className="management-graph-empty">No benchmark runs yet.</div>
            ) : (
              <>
                <div className="management-table-wrap">
                  <table className="management-table">
                    <thead>
                      <tr>
                        <th>Model</th>
                        <th>Overall</th>
                        <th>Auto</th>
                        <th>Success</th>
                        <th>Latency</th>
                        <th>Tokens</th>
                        <th>Errors</th>
                        <th>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedRun.candidateResults.map((candidate) => {
                        const isExpanded = expandedCandidateIds.includes(candidate.candidateId);
                        return (
                          <tr key={candidate.candidateId}>
                            <td>
                              <div className="management-user-name">{candidate.provider} / {candidate.model}</div>
                              <span className="management-subtitle">automatic</span>
                            </td>
                            <td>{formatScore(candidate.overallScore)}</td>
                            <td>{formatScore(candidate.automaticScore)}</td>
                            <td>{formatPercent(candidate.successRate)}</td>
                            <td>{formatLatency(candidate.averageLatencyMs)}</td>
                            <td>{candidate.totalTokens}</td>
                            <td>{candidate.errorCount}</td>
                            <td>
                              <button
                                type="button"
                                className="btn-primary management-benchmark-expand-button"
                                aria-expanded={isExpanded}
                                onClick={() => toggleCandidateDetails(candidate.candidateId)}
                              >
                                {isExpanded ? 'Collapse' : 'Expand'}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {expandedCandidateResults.length > 0 ? (
                  <div className="management-benchmark-details">
                    {expandedCandidateResults.map((candidate) => {
                      return (
                        <article key={candidate.candidateId} className="management-benchmark-result">
                          <header>
                            <h3>{candidate.provider} / {candidate.model}</h3>
                            <span>
                              {candidate.available ? `Score ${formatScore(candidate.overallScore)}` : candidate.unavailableReason}
                            </span>
                          </header>

                          {candidate.caseResults.map((caseResult) => {
                            const caseExpansionId = buildCaseExpansionId(candidate.candidateId, caseResult.caseId);
                            const isCaseExpanded = expandedCaseIds.includes(caseExpansionId);
                            return (
                              <div key={caseResult.caseId} className="management-benchmark-case-result">
                                <div className="management-benchmark-case-result-header">
                                  <strong>{caseResult.caseTitle}</strong>
                                  <button
                                    type="button"
                                    className="btn-primary management-benchmark-expand-button"
                                    aria-expanded={isCaseExpanded}
                                    onClick={() => toggleCaseDetails(candidate.candidateId, caseResult.caseId)}
                                  >
                                    {isCaseExpanded ? 'Collapse' : 'Expand'}
                                  </button>
                                  <span>
                                    {caseResult.success ? 'Passed' : 'Needs review'} / {formatLatency(caseResult.latencyMs)}
                                    {' / '}
                                    {caseResult.totalTokens} tokens
                                  </span>
                                </div>
                                {isCaseExpanded ? (
                                  <>
                                    <p>{caseResult.finalReply || 'No reply captured.'}</p>
                                    {caseResult.failedAssertions.length > 0 ? (
                                      <ul>
                                        {caseResult.failedAssertions.map((failure) => <li key={failure}>{failure}</li>)}
                                      </ul>
                                    ) : null}
                                  </>
                                ) : null}
                              </div>
                            );
                          })}
                        </article>
                      );
                    })}
                  </div>
                ) : null}
              </>
            )}
          </div>
        </section>
      ) : null}
    </main>
  );
};
