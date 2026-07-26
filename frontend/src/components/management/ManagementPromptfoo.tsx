import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import iconArrowRight from '../../assets/icon-arrow-right.svg';
import { ENV } from '../../config';
import { apiFetch } from '../../lib/apiClient';
import {
  MANAGEMENT_PROMPTFOO_RUN_ERROR_MESSAGE,
  MANAGEMENT_PROMPTFOO_STATUS_ERROR_MESSAGE,
  PROMPTFOO_RUNS_PATH,
  PROMPTFOO_RUN_STATUS_PATH,
  PROMPTFOO_VIEW_DEFAULT_URL,
} from './management.consts';
import type { PromptfooRunSnapshot } from './management.types';
import { parsePromptfooRunSnapshot, readManagementErrorMessage } from './management.utils';
import './Management.css';

const promptfooViewUrl = ENV.PROMPTFOO_VIEW_URL || PROMPTFOO_VIEW_DEFAULT_URL;
const STATUS_POLL_MS = 2_000;

export const ManagementPromptfoo = () => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeSrc, setIframeSrc] = useState(promptfooViewUrl);
  const [runStatus, setRunStatus] = useState<PromptfooRunSnapshot | null>(null);
  const [filterFirstN, setFilterFirstN] = useState('');
  const [filterPattern, setFilterPattern] = useState('');
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const isRunning = runStatus?.status === 'running' || isStarting;

  const refreshViewer = (): void => {
    setIframeSrc(`${promptfooViewUrl}?t=${Date.now()}`);
  };

  const loadStatus = async (): Promise<PromptfooRunSnapshot | null> => {
    const response = await apiFetch(PROMPTFOO_RUN_STATUS_PATH);
    if (!response.ok) {
      setError(await readManagementErrorMessage(response, MANAGEMENT_PROMPTFOO_STATUS_ERROR_MESSAGE));
      return null;
    }

    const payload: unknown = await response.json();
    const parsed = parsePromptfooRunSnapshot(payload);
    if (!parsed) {
      setError(MANAGEMENT_PROMPTFOO_STATUS_ERROR_MESSAGE);
      return null;
    }

    setRunStatus(parsed);
    return parsed;
  };

  useEffect(() => {
    void loadStatus();
  }, []);

  useEffect(() => {
    if (runStatus?.status !== 'running') {
      return;
    }

    const intervalId = window.setInterval(() => {
      void loadStatus().then((snapshot) => {
        if (snapshot?.status === 'completed') {
          setSuccessMessage(
            snapshot.exitCode === 0
              ? 'Promptfoo run completed.'
              : `Promptfoo run finished (exit ${snapshot.exitCode ?? '?'}). Check results below.`,
          );
          refreshViewer();
        }
        if (snapshot?.status === 'failed') {
          setError(snapshot.error ?? MANAGEMENT_PROMPTFOO_RUN_ERROR_MESSAGE);
        }
      });
    }, STATUS_POLL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [runStatus?.status]);

  const handleRun = async (): Promise<void> => {
    setIsStarting(true);
    setError('');
    setSuccessMessage('');

    const body: {
      filterFirstN?: number;
      filterPattern?: string;
      noCache: boolean;
    } = { noCache: true };

    const firstN = Number(filterFirstN);
    if (filterFirstN.trim().length > 0 && Number.isInteger(firstN) && firstN > 0) {
      body.filterFirstN = firstN;
    }
    if (filterPattern.trim().length > 0) {
      body.filterPattern = filterPattern.trim();
    }

    const response = await apiFetch(PROMPTFOO_RUNS_PATH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    setIsStarting(false);

    if (!response.ok) {
      setError(await readManagementErrorMessage(response, MANAGEMENT_PROMPTFOO_RUN_ERROR_MESSAGE));
      return;
    }

    const payload: unknown = await response.json();
    const parsed = parsePromptfooRunSnapshot(payload);
    if (!parsed) {
      setError(MANAGEMENT_PROMPTFOO_RUN_ERROR_MESSAGE);
      return;
    }

    setRunStatus(parsed);
    setSuccessMessage('Promptfoo run started. Results will appear in the viewer when finished.');
  };

  return (
    <main className="management-page management-page--promptfoo">
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
            <h1>Promptfoo tests</h1>
          </div>
          <p className="management-subtitle">
            Run Promptfoo evaluations and view results. Keep the viewer up with{' '}
            <code className="management-inline-code">npm run dev</code> (Promptfoo viewer on port 15500).
          </p>
        </div>

        <div className="management-promptfoo-actions">
          <a className="management-home-card-action" href={promptfooViewUrl} target="_blank" rel="noreferrer">
            Open in new tab
          </a>
          <button type="button" className="btn-outline" onClick={refreshViewer} disabled={isRunning}>
            Refresh viewer
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={isRunning}
            onClick={() => {
              handleRun().catch((runError: unknown) => {
                setIsStarting(false);
                setError(runError instanceof Error ? runError.message : MANAGEMENT_PROMPTFOO_RUN_ERROR_MESSAGE);
              });
            }}
          >
            {isRunning ? 'Running…' : 'Run Promptfoo'}
          </button>
        </div>
      </section>

      <section className="management-promptfoo-controls" aria-label="Promptfoo run options">
        <label className="management-promptfoo-field">
          <span>First N tests (optional)</span>
          <input
            type="number"
            min={1}
            inputMode="numeric"
            placeholder="All"
            value={filterFirstN}
            disabled={isRunning}
            onChange={(event) => setFilterFirstN(event.target.value)}
          />
        </label>
        <label className="management-promptfoo-field">
          <span>Filter pattern (optional)</span>
          <input
            type="text"
            placeholder="e.g. eval-01|dreamjob"
            value={filterPattern}
            disabled={isRunning}
            onChange={(event) => setFilterPattern(event.target.value)}
          />
        </label>
        {runStatus && (
          <p className="management-promptfoo-status" aria-live="polite">
            Status: <strong>{runStatus.status}</strong>
            {runStatus.runId ? ` · ${runStatus.runId.slice(0, 8)}` : ''}
            {runStatus.exitCode !== null ? ` · exit ${runStatus.exitCode}` : ''}
          </p>
        )}
      </section>

      {error && (
        <div className="management-alert" role="alert">
          {error}
        </div>
      )}
      {successMessage && !error && (
        <div className="management-alert management-alert--success" role="status">
          {successMessage}
        </div>
      )}

      {runStatus && runStatus.logTail.length > 0 && (
        <section className="management-promptfoo-log" aria-label="Promptfoo run log">
          <pre>{runStatus.logTail.join('\n')}</pre>
        </section>
      )}

      <section className="management-promptfoo" aria-label="Promptfoo evaluation viewer">
        <iframe
          ref={iframeRef}
          className="management-promptfoo-iframe"
          title="Promptfoo evaluation viewer"
          src={iframeSrc}
          allow="clipboard-read; clipboard-write"
        />
      </section>
    </main>
  );
};
