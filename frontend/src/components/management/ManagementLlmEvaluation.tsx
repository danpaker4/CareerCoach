import { Fragment, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import iconArrowRight from '../../assets/icon-arrow-right.svg';
import { ManagementIconDelete, ManagementIconPlay } from './management-eval-icons';
import { apiFetch } from '../../lib/apiClient';
import {
  EVALUATION_CASE_FILE_FIELD,
  EVALUATION_CASE_JSON_ACCEPT,
  EVALUATION_CASES_PATH,
  MANAGEMENT_EVALUATION_DELETE_ERROR_MESSAGE,
  MANAGEMENT_EVALUATION_INVALID_FILE_MESSAGE,
  MANAGEMENT_EVALUATION_LOAD_ERROR_MESSAGE,
  MANAGEMENT_EVALUATION_RUN_ALL_ERROR_MESSAGE,
  MANAGEMENT_EVALUATION_RUN_ERROR_MESSAGE,
  MANAGEMENT_EVALUATION_UPLOAD_ERROR_MESSAGE,
} from './management.consts';
import type {
  EvaluationCaseSummary,
  EvaluationMessage,
  EvaluationMode,
  EvaluationRunResult,
  ManagementStatus,
} from './management.types';
import {
  buildEvaluationCaseUrl,
  buildEvaluationComparisonRowsFromChecks,
  fetchEvaluationRunResult,
  isJsonEvaluationFile,
  parseEvaluationCases,
  readManagementErrorMessage,
} from './management.utils';
import './Management.css';

const formatNumber = (value: number): string => new Intl.NumberFormat('en-US').format(value);

const formatDateTime = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};

const formatDuration = (durationMs: number): string => `${(durationMs / 1000).toFixed(1)}s`;
const EVALUATION_MODE_FILTER_ORDER: EvaluationMode[] = ['GUIDED', 'NEAR_TERM', 'DREAMJOB'];

const formatMessageRoleLabel = (role: EvaluationMessage['role']): string => {
  if (role === 'user') {
    return 'User';
  }

  if (role === 'assistant') {
    return 'Assistant';
  }

  return 'System';
};

const EvaluationRunConversation = ({ messages }: { messages: EvaluationMessage[] }) => (
  <div className="management-eval-conversation">
    <p className="management-eval-result-label">Conversation</p>
    {messages.length === 0 ? (
      <p className="management-eval-conversation-empty">No messages in this run.</p>
    ) : (
      <div className="management-eval-conversation-list">
        {messages.map((message, index) => (
          <div
            key={`${message.role}-${index}-${message.content.slice(0, 24)}`}
            className={`management-eval-message management-eval-message--${message.role}`}
          >
            <span className="management-eval-message-role">{formatMessageRoleLabel(message.role)}</span>
            <pre className="management-eval-message-content">{message.content}</pre>
          </div>
        ))}
      </div>
    )}
  </div>
);

const EvaluationExpectedComparison = ({ runResult }: { runResult: EvaluationRunResult }) => {
  const rows = buildEvaluationComparisonRowsFromChecks(runResult.checks);

  return (
    <div className="management-eval-comparison">
      <p className="management-eval-result-label">Expected vs got</p>
      <div className="management-eval-comparison-list">
        {rows.map((row) => (
          <div
            key={row.key}
            className={`management-eval-comparison-item management-eval-comparison-item--${
              row.passed === true ? 'pass' : row.passed === false ? 'fail' : 'neutral'
            }`}
          >
            <div className="management-eval-comparison-item-header">
              <span className="management-eval-field-key">{row.key}</span>
              {row.passed !== null && (
                <span className="management-eval-comparison-verdict" aria-label={row.passed ? 'Passed' : 'Failed'}>
                  {row.passed ? '✓' : '✗'}
                </span>
              )}
            </div>
            <div className="management-eval-comparison-pair">
              <div className="management-eval-comparison-side">
                <span className="management-eval-comparison-side-label">Expected</span>
                <pre className="management-eval-field-value">{row.expectedDisplay}</pre>
              </div>
              <div className="management-eval-comparison-side">
                <span className="management-eval-comparison-side-label">Got</span>
                <pre className="management-eval-field-value">{row.gotDisplay}</pre>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const ManagementLlmEvaluation = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cases, setCases] = useState<EvaluationCaseSummary[]>([]);
  const [status, setStatus] = useState<ManagementStatus>('loading');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [deletingCaseId, setDeletingCaseId] = useState<string | null>(null);
  const [runningCaseId, setRunningCaseId] = useState<string | null>(null);
  const [isRunningAll, setIsRunningAll] = useState(false);
  const [runAllProgress, setRunAllProgress] = useState<{ current: number; total: number } | null>(null);
  const [runResults, setRunResults] = useState<Record<string, EvaluationRunResult>>({});
  const [expandedResultCaseId, setExpandedResultCaseId] = useState<string | null>(null);
  const [expandedPreviewCaseId, setExpandedPreviewCaseId] = useState<string | null>(null);
  const [modeFilter, setModeFilter] = useState<'ALL' | EvaluationMode>('ALL');
  const [minMessagesFilter, setMinMessagesFilter] = useState('');
  const [maxMessagesFilter, setMaxMessagesFilter] = useState('');

  const loadCases = async (preserveAlerts = false): Promise<void> => {
    setStatus('loading');
    if (!preserveAlerts) {
      setError('');
      setSuccessMessage('');
    }

    const response = await apiFetch(EVALUATION_CASES_PATH);
    if (!response.ok) {
      setCases([]);
      setStatus('error');
      setError(await readManagementErrorMessage(response, MANAGEMENT_EVALUATION_LOAD_ERROR_MESSAGE));
      return;
    }

    const payload: unknown = await response.json().catch(() => null);
    setCases(parseEvaluationCases(payload));
    setStatus('success');
  };

  useEffect(() => {
    loadCases().catch((loadError: unknown) => {
      setCases([]);
      setStatus('error');
      setError(loadError instanceof Error ? loadError.message : MANAGEMENT_EVALUATION_LOAD_ERROR_MESSAGE);
    });
  }, []);

  const handleAddConversationClick = (): void => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    if (!isJsonEvaluationFile(file)) {
      setError(MANAGEMENT_EVALUATION_INVALID_FILE_MESSAGE);
      return;
    }

    setIsUploading(true);
    setError('');
    setSuccessMessage('');

    const formData = new FormData();
    formData.append(EVALUATION_CASE_FILE_FIELD, file);

    try {
      const response = await apiFetch(EVALUATION_CASES_PATH, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        setError(await readManagementErrorMessage(response, MANAGEMENT_EVALUATION_UPLOAD_ERROR_MESSAGE));
        return;
      }

      const payload: unknown = await response.json().catch(() => null);
      if (typeof payload === 'object' && payload !== null && 'id' in payload && typeof payload.id === 'string') {
        setSuccessMessage(`Added conversation "${payload.id}".`);
      } else {
        setSuccessMessage('Conversation added successfully.');
      }

      await loadCases(true);
    } catch (uploadError: unknown) {
      setError(uploadError instanceof Error ? uploadError.message : MANAGEMENT_EVALUATION_UPLOAD_ERROR_MESSAGE);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (caseId: string): Promise<void> => {
    setDeletingCaseId(caseId);
    setError('');
    setSuccessMessage('');

    try {
      const response = await apiFetch(buildEvaluationCaseUrl(caseId), { method: 'DELETE' });
      if (!response.ok) {
        setError(await readManagementErrorMessage(response, MANAGEMENT_EVALUATION_DELETE_ERROR_MESSAGE));
        return;
      }

      setRunResults((current) => {
        const next = { ...current };
        delete next[caseId];
        return next;
      });
      if (expandedResultCaseId === caseId) {
        setExpandedResultCaseId(null);
      }
      if (expandedPreviewCaseId === caseId) {
        setExpandedPreviewCaseId(null);
      }

      setSuccessMessage(`Deleted conversation "${caseId}".`);
      await loadCases(true);
    } catch (deleteError: unknown) {
      setError(deleteError instanceof Error ? deleteError.message : MANAGEMENT_EVALUATION_DELETE_ERROR_MESSAGE);
    } finally {
      setDeletingCaseId(null);
    }
  };

  const handleRun = async (caseId: string): Promise<void> => {
    setRunningCaseId(caseId);
    setError('');
    setSuccessMessage('');

    try {
      const parsed = await fetchEvaluationRunResult(caseId);
      setRunResults((current) => ({ ...current, [caseId]: parsed }));
      setExpandedResultCaseId(caseId);
      setExpandedPreviewCaseId((current) => (current === caseId ? null : current));
      setSuccessMessage(
        parsed.passed
          ? `Evaluation "${caseId}" passed.`
          : `Evaluation "${caseId}" failed. Expand the row to see details.`,
      );
    } catch (runError: unknown) {
      setError(runError instanceof Error ? runError.message : MANAGEMENT_EVALUATION_RUN_ERROR_MESSAGE);
    } finally {
      setRunningCaseId(null);
    }
  };

  const handleRunAll = async (): Promise<void> => {
    if (cases.length === 0) {
      return;
    }

    setIsRunningAll(true);
    setRunAllProgress({ current: 0, total: cases.length });
    setError('');
    setSuccessMessage('');

    const runErrors: string[] = [];
    let passedCount = 0;
    let completedCount = 0;

    for (const [index, evaluationCase] of cases.entries()) {
      const caseId = evaluationCase.id;
      setRunningCaseId(caseId);
      setRunAllProgress({ current: index + 1, total: cases.length });

      try {
        const parsed = await fetchEvaluationRunResult(caseId);
        setRunResults((current) => ({ ...current, [caseId]: parsed }));
        completedCount += 1;
        if (parsed.passed) {
          passedCount += 1;
        }
      } catch (runError: unknown) {
        const message = runError instanceof Error ? runError.message : MANAGEMENT_EVALUATION_RUN_ERROR_MESSAGE;
        runErrors.push(`${caseId}: ${message}`);
      }
    }

    setRunningCaseId(null);
    setRunAllProgress(null);
    setIsRunningAll(false);
    setExpandedPreviewCaseId(null);

    if (completedCount === 0) {
      setError(runErrors[0] ?? MANAGEMENT_EVALUATION_RUN_ALL_ERROR_MESSAGE);
      return;
    }

    const failedCount = completedCount - passedCount;
    const summaryParts = [
      `Ran ${completedCount} of ${cases.length} evaluation${cases.length === 1 ? '' : 's'}.`,
      `${passedCount} passed`,
      failedCount > 0 ? `${failedCount} failed` : null,
    ].filter((part): part is string => part !== null);

    setSuccessMessage(summaryParts.join(', ') + '.');

    if (runErrors.length > 0) {
      setError(runErrors.join(' '));
    }
  };

  const isActionDisabled = isUploading || deletingCaseId !== null || runningCaseId !== null || isRunningAll;
  const availableModes = EVALUATION_MODE_FILTER_ORDER.filter((mode) =>
    cases.some((evaluationCase) => evaluationCase.expected.mode === mode),
  );
  const parsedMinMessages = minMessagesFilter === '' ? null : Number(minMessagesFilter);
  const parsedMaxMessages = maxMessagesFilter === '' ? null : Number(maxMessagesFilter);
  const hasValidMinFilter =
    parsedMinMessages === null || (Number.isInteger(parsedMinMessages) && parsedMinMessages >= 0);
  const hasValidMaxFilter =
    parsedMaxMessages === null || (Number.isInteger(parsedMaxMessages) && parsedMaxMessages >= 0);
  const hasValidMessageRange =
    hasValidMinFilter &&
    hasValidMaxFilter &&
    (parsedMinMessages === null || parsedMaxMessages === null || parsedMinMessages <= parsedMaxMessages);
  const filteredCases =
    hasValidMessageRange && hasValidMinFilter && hasValidMaxFilter
      ? cases.filter((evaluationCase) => {
          const modeMatches = modeFilter === 'ALL' || evaluationCase.expected.mode === modeFilter;
          const messageCount = evaluationCase.messages.length;
          const minMatches = parsedMinMessages === null || messageCount >= parsedMinMessages;
          const maxMatches = parsedMaxMessages === null || messageCount <= parsedMaxMessages;
          return modeMatches && minMatches && maxMatches;
        })
      : [];
  const hasActiveFilters = modeFilter !== 'ALL' || minMessagesFilter !== '' || maxMessagesFilter !== '';

  return (
    <main className="management-page">
      <section className="management-header">
        <div>
          <p className="management-eyebrow">Quality</p>
          <div className="management-title-row">
            <Link
              to="/management"
              className="management-back-icon-button"
              aria-label="Back to management home"
              title="Management home"
            >
              <img src={iconArrowRight} alt="" aria-hidden="true" className="management-back-icon" />
            </Link>
            <h1>LLM evaluation</h1>
          </div>
          <p className="management-subtitle">Upload evaluation conversations, run them against chat, and review results.</p>
        </div>
      </section>

      {error && <p className="management-alert management-alert--error">{error}</p>}
      {successMessage && <p className="management-alert management-alert--success">{successMessage}</p>}

      <section className="management-llm-evaluation" aria-label="LLM evaluation">
        <div className="management-users-header">
          <div>
            <p className="management-eyebrow">Conversations</p>
            <h2>Evaluation cases</h2>
            <p className="management-subtitle">
              {status === 'success'
                ? hasActiveFilters
                  ? `${formatNumber(filteredCases.length)} of ${formatNumber(cases.length)} conversation${
                      cases.length === 1 ? '' : 's'
                    } shown`
                  : `${formatNumber(cases.length)} conversation${cases.length === 1 ? '' : 's'} stored`
                : 'Upload a JSON file to add a new evaluation conversation.'}
            </p>
          </div>
          <div className="management-llm-evaluation-actions">
            <input
              ref={fileInputRef}
              type="file"
              accept={EVALUATION_CASE_JSON_ACCEPT}
              className="management-file-input"
              onChange={(event) => {
                handleFileSelected(event).catch((uploadError: unknown) => {
                  setIsUploading(false);
                  setError(uploadError instanceof Error ? uploadError.message : MANAGEMENT_EVALUATION_UPLOAD_ERROR_MESSAGE);
                });
              }}
            />
            <button
              type="button"
              className="btn-outline"
              disabled={status === 'loading' || cases.length === 0 || isActionDisabled}
              onClick={() => {
                handleRunAll().catch((runAllError: unknown) => {
                  setIsRunningAll(false);
                  setRunningCaseId(null);
                  setRunAllProgress(null);
                  setError(
                    runAllError instanceof Error ? runAllError.message : MANAGEMENT_EVALUATION_RUN_ALL_ERROR_MESSAGE,
                  );
                });
              }}
            >
              {isRunningAll && runAllProgress
                ? `Running ${runAllProgress.current}/${runAllProgress.total}...`
                : 'Run All'}
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={status === 'loading' || isActionDisabled}
              onClick={handleAddConversationClick}
            >
              {isUploading ? 'Uploading...' : 'Add Conversation'}
            </button>
          </div>
        </div>
        {status !== 'loading' && cases.length > 0 && (
          <div className="management-eval-filters">
            <div className="management-eval-filter-group">
              <label htmlFor="management-eval-mode-filter">Mode</label>
              <select
                id="management-eval-mode-filter"
                value={modeFilter}
                onChange={(event) => {
                  const nextMode = event.target.value as 'ALL' | EvaluationMode;
                  setModeFilter(nextMode);
                }}
              >
                <option value="ALL">All modes</option>
                {availableModes.map((mode) => (
                  <option key={mode} value={mode}>
                    {mode}
                  </option>
                ))}
              </select>
            </div>
            <div className="management-eval-filter-group">
              <label htmlFor="management-eval-min-messages-filter">Min messages</label>
              <input
                id="management-eval-min-messages-filter"
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                value={minMessagesFilter}
                onChange={(event) => {
                  setMinMessagesFilter(event.target.value);
                }}
                placeholder="Any"
              />
            </div>
            <div className="management-eval-filter-group">
              <label htmlFor="management-eval-max-messages-filter">Max messages</label>
              <input
                id="management-eval-max-messages-filter"
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                value={maxMessagesFilter}
                onChange={(event) => {
                  setMaxMessagesFilter(event.target.value);
                }}
                placeholder="Any"
              />
            </div>
            <button
              type="button"
              className="btn-outline management-eval-filter-reset"
              disabled={!hasActiveFilters}
              onClick={() => {
                setModeFilter('ALL');
                setMinMessagesFilter('');
                setMaxMessagesFilter('');
              }}
            >
              Reset filters
            </button>
          </div>
        )}
        {status !== 'loading' && cases.length > 0 && !hasValidMessageRange && (
          <p className="management-alert management-alert--error">Message range is invalid. Min must be less than or equal to max.</p>
        )}

        {status === 'loading' && (
          <div className="page-loading management-state">
            <div className="spinner" />
            <p>Loading evaluation conversations...</p>
          </div>
        )}

        {status !== 'loading' && cases.length === 0 && (
          <div className="page-empty management-state">
            <p>No evaluation conversations yet. Use Add Conversation to upload a JSON file.</p>
          </div>
        )}

        {status !== 'loading' && cases.length > 0 && hasValidMessageRange && filteredCases.length === 0 && (
          <div className="page-empty management-state">
            <p>No evaluation conversations match the selected filters.</p>
          </div>
        )}

        {status !== 'loading' && cases.length > 0 && hasValidMessageRange && filteredCases.length > 0 && (
          <div className="management-table-wrap">
            <table className="management-table management-table--evaluation">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Mode</th>
                  <th>Messages</th>
                  <th>Last run</th>
                  <th>Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCases.map((evaluationCase) => {
                  const runResult = runResults[evaluationCase.id];
                  const isExpanded = expandedResultCaseId === evaluationCase.id && runResult !== undefined;
                  const isPreviewExpanded = expandedPreviewCaseId === evaluationCase.id;

                  return (
                    <Fragment key={evaluationCase.id}>
                      <tr
                        className={
                          runningCaseId === evaluationCase.id ? 'management-eval-row--running' : undefined
                        }
                      >
                        <td>
                          <span className="management-user-name">{evaluationCase.id}</span>
                        </td>
                        <td>{evaluationCase.expected.mode ?? '—'}</td>
                        <td>{formatNumber(evaluationCase.messages.length)}</td>
                        <td>
                          {runResult ? (
                            <span
                              className={`management-eval-status management-eval-status--${runResult.passed ? 'pass' : 'fail'}`}
                            >
                              {runResult.passed ? 'Passed' : 'Failed'}
                            </span>
                          ) : (
                            <span className="management-eval-status management-eval-status--idle">Not run</span>
                          )}
                        </td>
                        <td>{formatDateTime(evaluationCase.updatedAt)}</td>
                        <td>
                          <div className="management-actions">
                            <button
                              type="button"
                              className="btn-outline management-action-button management-action-button--icon"
                              disabled={isActionDisabled}
                              aria-label={
                                runningCaseId === evaluationCase.id
                                  ? 'Running evaluation'
                                  : `Run evaluation ${evaluationCase.id}`
                              }
                              title={runningCaseId === evaluationCase.id ? 'Running...' : 'Run'}
                              aria-busy={runningCaseId === evaluationCase.id}
                              onClick={() => {
                                handleRun(evaluationCase.id).catch((runError: unknown) => {
                                  setRunningCaseId(null);
                                  setError(
                                    runError instanceof Error ? runError.message : MANAGEMENT_EVALUATION_RUN_ERROR_MESSAGE,
                                  );
                                });
                              }}
                            >
                              <ManagementIconPlay className="management-action-icon" />
                            </button>
                            <button
                              type="button"
                              className="btn-outline management-action-button management-action-button--icon management-action-button--danger"
                              disabled={isActionDisabled}
                              aria-label={
                                deletingCaseId === evaluationCase.id
                                ? 'Deleting evaluation'
                                : `Delete evaluation ${evaluationCase.id}`
                              }
                              title={deletingCaseId === evaluationCase.id ? 'Deleting...' : 'Delete'}
                              aria-busy={deletingCaseId === evaluationCase.id}
                              onClick={() => {
                                handleDelete(evaluationCase.id).catch((deleteError: unknown) => {
                                  setDeletingCaseId(null);
                                  setError(
                                    deleteError instanceof Error
                                    ? deleteError.message
                                    : MANAGEMENT_EVALUATION_DELETE_ERROR_MESSAGE,
                                  );
                                });
                              }}
                              >
                              <ManagementIconDelete className="management-action-icon" />
                            </button>
                            {!runResult && (
                              <button
                                type="button"
                                className="btn-outline management-action-button"
                                onClick={() => {
                                  setExpandedPreviewCaseId(isPreviewExpanded ? null : evaluationCase.id);
                                }}
                              >
                                {isPreviewExpanded ? 'Hide Chat' : 'Preview Chat'}
                              </button>
                            )}
                              {runResult && (
                                <button
                                  type="button"
                                  className="btn-outline management-action-button"
                                  disabled={isActionDisabled}
                                  onClick={() => {
                                    setExpandedResultCaseId(isExpanded ? null : evaluationCase.id);
                                  }}
                                >
                                  {isExpanded ? 'Hide' : 'Details'}
                                </button>
                              )}
                          </div>
                        </td>
                      </tr>
                      {isPreviewExpanded && !runResult && (
                        <tr className="management-eval-result-row management-eval-preview-row">
                          <td colSpan={6}>
                            <div className="management-eval-result-panel">
                              <div className="management-eval-result-header">
                                <h3>Case conversation preview</h3>
                                <p>
                                  {formatNumber(evaluationCase.messages.length)} message
                                  {evaluationCase.messages.length === 1 ? '' : 's'}
                                </p>
                              </div>
                              <EvaluationRunConversation messages={evaluationCase.messages} />
                            </div>
                          </td>
                        </tr>
                      )}
                      {isExpanded && runResult && (
                        <tr className="management-eval-result-row">
                          <td colSpan={6}>
                            <div className="management-eval-result-panel">
                              <div className="management-eval-result-header">
                                <h3>Run result</h3>
                                <p>
                                  {runResult.passed ? 'Passed' : 'Failed'} in {formatDuration(runResult.metadata.durationMs)}
                                  {runResult.mode ? ` · mode ${runResult.mode}` : ''}
                                </p>
                              </div>
                              <EvaluationRunConversation messages={runResult.conversation} />
                              <EvaluationExpectedComparison runResult={runResult} />
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
};
