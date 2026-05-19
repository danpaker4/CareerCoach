import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import iconArrowRight from '../../assets/icon-arrow-right.svg';
import { apiFetch } from '../../lib/apiClient';
import {
  ADMIN_BENCHMARKS_PATH,
  MANAGEMENT_BENCHMARK_LOAD_ERROR_MESSAGE,
  MANAGEMENT_BENCHMARK_RUN_ERROR_MESSAGE,
  MANAGEMENT_BENCHMARK_SCORE_ERROR_MESSAGE,
} from './management.consts';
import type {
  BenchmarkCandidateId,
  BenchmarkConfig,
  BenchmarkManualScore,
  BenchmarkRunSummary,
  BenchmarkStatus,
} from './management.types';
import {
  buildBenchmarkRunScoreUrl,
  buildBenchmarksRunsUrl,
  parseBenchmarkConfig,
  parseBenchmarkRun,
  parseBenchmarkRuns,
  readManagementErrorMessage,
} from './management.utils';
import './Management.css';

const RUN_HISTORY_LIMIT = 10;

const DEFAULT_MANUAL_SCORE: BenchmarkManualScore = {
  relevance: 3,
  personalization: 3,
  actionability: 3,
  clarity: 3,
  safety: 3,
  notes: '',
};

const scoreFields = [
  { key: 'relevance', label: 'Relevance' },
  { key: 'personalization', label: 'Personalization' },
  { key: 'actionability', label: 'Actionability' },
  { key: 'clarity', label: 'Clarity' },
  { key: 'safety', label: 'Safety' },
] as const;

const formatPercent = (value: number): string => `${Math.round(value * 100)}%`;

const formatScore = (value: number): string => `${Math.round(value)}`;

const formatLatency = (value: number): string => `${Math.round(value)}ms`;

const formatDateTime = (value: string): string => new Date(value).toLocaleString();

export const ManagementBenchmarks = () => {
  const [status, setStatus] = useState<BenchmarkStatus>('loading');
  const [runStatus, setRunStatus] = useState<'idle' | 'running'>('idle');
  const [scoreStatus, setScoreStatus] = useState<'idle' | 'saving'>('idle');
  const [error, setError] = useState('');
  const [config, setConfig] = useState<BenchmarkConfig | null>(null);
  const [runs, setRuns] = useState<BenchmarkRunSummary[]>([]);
  const [selectedCaseIds, setSelectedCaseIds] = useState<string[]>([]);
  const [selectedRunId, setSelectedRunId] = useState('');
  const [scoreDrafts, setScoreDrafts] = useState<Record<string, BenchmarkManualScore>>({});

  const selectedRun = useMemo(
    () => runs.find((run) => run.id === selectedRunId) ?? runs[0] ?? null,
    [runs, selectedRunId],
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

  const handleCaseToggle = (caseId: string): void => {
    setSelectedCaseIds((currentCaseIds) =>
      currentCaseIds.includes(caseId)
        ? currentCaseIds.filter((currentCaseId) => currentCaseId !== caseId)
        : [...currentCaseIds, caseId],
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

  const readDraft = (candidateId: BenchmarkCandidateId, existingScore?: BenchmarkManualScore): BenchmarkManualScore =>
    scoreDrafts[candidateId] ?? existingScore ?? DEFAULT_MANUAL_SCORE;

  const updateDraftNumber = (candidateId: BenchmarkCandidateId, field: keyof Omit<BenchmarkManualScore, 'notes' | 'updatedAt'>, value: string): void => {
    const numericValue = Math.max(1, Math.min(5, Number(value)));
    setScoreDrafts((currentDrafts) => ({
      ...currentDrafts,
      [candidateId]: {
        ...readDraft(candidateId, selectedRun?.candidateResults.find((candidate) => candidate.candidateId === candidateId)?.manualScore),
        [field]: Number.isFinite(numericValue) ? numericValue : 3,
      },
    }));
  };

  const updateDraftNotes = (candidateId: BenchmarkCandidateId, event: ChangeEvent<HTMLTextAreaElement>): void => {
    setScoreDrafts((currentDrafts) => ({
      ...currentDrafts,
      [candidateId]: {
        ...readDraft(candidateId, selectedRun?.candidateResults.find((candidate) => candidate.candidateId === candidateId)?.manualScore),
        notes: event.target.value,
      },
    }));
  };

  const saveScore = async (runId: string, candidateId: BenchmarkCandidateId, existingScore?: BenchmarkManualScore): Promise<void> => {
    setScoreStatus('saving');
    setError('');

    const response = await apiFetch(buildBenchmarkRunScoreUrl(runId), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        candidateId,
        manualScore: readDraft(candidateId, existingScore),
      }),
    });

    if (!response.ok) {
      setScoreStatus('idle');
      setError(await readManagementErrorMessage(response, MANAGEMENT_BENCHMARK_SCORE_ERROR_MESSAGE));
      return;
    }

    const payload: unknown = await response.json().catch(() => null);
    const parsedRun = parseBenchmarkRun(payload);
    if (!parsedRun) {
      setScoreStatus('idle');
      setError(MANAGEMENT_BENCHMARK_SCORE_ERROR_MESSAGE);
      return;
    }

    setRuns((currentRuns) => currentRuns.map((run) => run.id === parsedRun.id ? parsedRun : run));
    setScoreStatus('idle');
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
                <p className="management-subtitle">Overall score uses manual scoring when available.</p>
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
                      </tr>
                    </thead>
                    <tbody>
                      {selectedRun.candidateResults.map((candidate) => (
                        <tr key={candidate.candidateId}>
                          <td>
                            <div className="management-user-name">{candidate.provider} / {candidate.model}</div>
                            <span className="management-subtitle">{candidate.scoreStatus}</span>
                          </td>
                          <td>{formatScore(candidate.overallScore)}</td>
                          <td>{formatScore(candidate.automaticScore)}</td>
                          <td>{formatPercent(candidate.successRate)}</td>
                          <td>{formatLatency(candidate.averageLatencyMs)}</td>
                          <td>{candidate.totalTokens}</td>
                          <td>{candidate.errorCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="management-benchmark-details">
                  {selectedRun.candidateResults.map((candidate) => {
                    const draft = readDraft(candidate.candidateId, candidate.manualScore);
                    return (
                      <article key={candidate.candidateId} className="management-benchmark-result">
                        <header>
                          <h3>{candidate.provider} / {candidate.model}</h3>
                          <span>{candidate.available ? `Score ${formatScore(candidate.overallScore)}` : candidate.unavailableReason}</span>
                        </header>

                        {candidate.caseResults.map((caseResult) => (
                          <div key={caseResult.caseId} className="management-benchmark-case-result">
                            <div>
                              <strong>{caseResult.caseTitle}</strong>
                              <span>{caseResult.success ? 'Passed' : 'Needs review'} · {formatLatency(caseResult.latencyMs)} · {caseResult.totalTokens} tokens</span>
                            </div>
                            <p>{caseResult.finalReply || 'No reply captured.'}</p>
                            {caseResult.failedAssertions.length > 0 ? (
                              <ul>
                                {caseResult.failedAssertions.map((failure) => <li key={failure}>{failure}</li>)}
                              </ul>
                            ) : null}
                          </div>
                        ))}

                        <div className="management-benchmark-score-form">
                          {scoreFields.map((field) => (
                            <label key={field.key}>
                              <span>{field.label}</span>
                              <input
                                type="number"
                                min="1"
                                max="5"
                                value={draft[field.key]}
                                onChange={(event) => updateDraftNumber(candidate.candidateId, field.key, event.target.value)}
                              />
                            </label>
                          ))}
                          <label className="management-benchmark-notes">
                            <span>Notes</span>
                            <textarea value={draft.notes} onChange={(event) => updateDraftNotes(candidate.candidateId, event)} />
                          </label>
                          <button
                            type="button"
                            className="btn-secondary"
                            disabled={scoreStatus === 'saving'}
                            onClick={() => { saveScore(selectedRun.id, candidate.candidateId, candidate.manualScore).catch(() => setScoreStatus('idle')); }}
                          >
                            {scoreStatus === 'saving' ? 'Saving...' : 'Save manual score'}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </section>
      ) : null}
    </main>
  );
};
