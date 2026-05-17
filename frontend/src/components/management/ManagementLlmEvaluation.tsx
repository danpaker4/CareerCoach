import { Fragment, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import iconArrowRight from '../../assets/icon-arrow-right.svg';
import { apiFetch } from '../../lib/apiClient';
import {
  buildEvaluationCaseRunUrl,
  EVALUATION_CASE_FILE_FIELD,
  EVALUATION_CASE_JSON_ACCEPT,
  EVALUATION_CASES_PATH,
  MANAGEMENT_EVALUATION_DELETE_ERROR_MESSAGE,
  MANAGEMENT_EVALUATION_INVALID_FILE_MESSAGE,
  MANAGEMENT_EVALUATION_LOAD_ERROR_MESSAGE,
  MANAGEMENT_EVALUATION_RUN_ERROR_MESSAGE,
  MANAGEMENT_EVALUATION_UPLOAD_ERROR_MESSAGE,
} from './management.consts';
import type { EvaluationCaseSummary, EvaluationRunResult, ManagementStatus } from './management.types';
import {
  buildEvaluationCaseUrl,
  isJsonEvaluationFile,
  parseEvaluationCases,
  parseEvaluationRunResult,
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

export const ManagementLlmEvaluation = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cases, setCases] = useState<EvaluationCaseSummary[]>([]);
  const [status, setStatus] = useState<ManagementStatus>('loading');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [deletingCaseId, setDeletingCaseId] = useState<string | null>(null);
  const [runningCaseId, setRunningCaseId] = useState<string | null>(null);
  const [runResults, setRunResults] = useState<Record<string, EvaluationRunResult>>({});
  const [expandedResultCaseId, setExpandedResultCaseId] = useState<string | null>(null);

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
      const response = await apiFetch(buildEvaluationCaseRunUrl(caseId), { method: 'POST' });
      if (!response.ok) {
        setError(await readManagementErrorMessage(response, MANAGEMENT_EVALUATION_RUN_ERROR_MESSAGE));
        return;
      }

      const payload: unknown = await response.json().catch(() => null);
      const parsed = parseEvaluationRunResult(payload);
      if (!parsed) {
        setError(MANAGEMENT_EVALUATION_RUN_ERROR_MESSAGE);
        return;
      }

      setRunResults((current) => ({ ...current, [caseId]: parsed }));
      setExpandedResultCaseId(caseId);
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

  const isActionDisabled = isUploading || deletingCaseId !== null || runningCaseId !== null;

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
                ? `${formatNumber(cases.length)} conversation${cases.length === 1 ? '' : 's'} stored`
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
              className="btn-primary"
              disabled={status === 'loading' || isActionDisabled}
              onClick={handleAddConversationClick}
            >
              {isUploading ? 'Uploading...' : 'Add Conversation'}
            </button>
          </div>
        </div>

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

        {status !== 'loading' && cases.length > 0 && (
          <div className="management-table-wrap">
            <table className="management-table management-table--evaluation">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Stage</th>
                  <th>Messages</th>
                  <th>Last run</th>
                  <th>Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((evaluationCase) => {
                  const runResult = runResults[evaluationCase.id];
                  const isExpanded = expandedResultCaseId === evaluationCase.id && runResult !== undefined;

                  return (
                    <Fragment key={evaluationCase.id}>
                      <tr>
                        <td>
                          <span className="management-user-name">{evaluationCase.id}</span>
                        </td>
                        <td>{evaluationCase.expected.stage}</td>
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
                              className="btn-outline management-action-button"
                              disabled={isActionDisabled}
                              onClick={() => {
                                handleRun(evaluationCase.id).catch((runError: unknown) => {
                                  setRunningCaseId(null);
                                  setError(
                                    runError instanceof Error ? runError.message : MANAGEMENT_EVALUATION_RUN_ERROR_MESSAGE,
                                  );
                                });
                              }}
                            >
                              {runningCaseId === evaluationCase.id ? 'Running...' : 'Run'}
                            </button>
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
                            <button
                              type="button"
                              className="btn-outline management-action-button management-action-button--danger"
                              disabled={isActionDisabled}
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
                              {deletingCaseId === evaluationCase.id ? 'Deleting...' : 'Delete'}
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && runResult && (
                        <tr className="management-eval-result-row">
                          <td colSpan={6}>
                            <div className="management-eval-result-panel">
                              <div className="management-eval-result-header">
                                <h3>Run result</h3>
                                <p>
                                  {runResult.passed ? 'Passed' : 'Failed'} in {formatDuration(runResult.metadata.durationMs)}
                                  {runResult.stage ? ` · stage ${runResult.stage}` : ''}
                                </p>
                              </div>
                              <div className="management-eval-result-reply">
                                <p className="management-eval-result-label">Assistant reply</p>
                                <pre>{runResult.reply}</pre>
                              </div>
                              <div className="management-eval-result-checks">
                                <p className="management-eval-result-label">Checks</p>
                                <ul>
                                  {runResult.checks.map((check) => (
                                    <li
                                      key={check.name}
                                      className={`management-eval-check management-eval-check--${check.passed ? 'pass' : 'fail'}`}
                                    >
                                      <span>{check.name}</span>
                                      <span>{check.passed ? 'pass' : 'fail'}</span>
                                      {check.message && <p>{check.message}</p>}
                                    </li>
                                  ))}
                                </ul>
                              </div>
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
