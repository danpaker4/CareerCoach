import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import iconArrowRight from '../../assets/icon-arrow-right.svg';
import { apiFetch } from '../../lib/apiClient';
import { MANAGEMENT_TOKEN_USAGE_LOAD_ERROR_MESSAGE } from './management.consts';
import type { AdminLlmTokenUsageResult, TokenUsageDays, TokenUsageStatus } from './management.types';
import { buildAdminLlmTokenUsageUrl, parseTokenUsage, readManagementErrorMessage } from './management.utils';
import { TokenUsageGraph } from './TokenUsageGraph';
import './Management.css';

export const ManagementUsage = () => {
  const [tokenUsageStatus, setTokenUsageStatus] = useState<TokenUsageStatus>('loading');
  const [tokenUsage, setTokenUsage] = useState<AdminLlmTokenUsageResult | null>(null);
  const [tokenUsageDays, setTokenUsageDays] = useState<TokenUsageDays>(30);
  const [tokenUsageError, setTokenUsageError] = useState('');

  const loadTokenUsage = async (days: TokenUsageDays): Promise<void> => {
    setTokenUsageStatus('loading');
    setTokenUsageError('');

    const response = await apiFetch(buildAdminLlmTokenUsageUrl(days));
    if (!response.ok) {
      setTokenUsage(null);
      setTokenUsageStatus('error');
      setTokenUsageError(await readManagementErrorMessage(response, MANAGEMENT_TOKEN_USAGE_LOAD_ERROR_MESSAGE));
      return;
    }

    const payload: unknown = await response.json().catch(() => null);
    const parsed = parseTokenUsage(payload);
    if (!parsed) {
      setTokenUsage(null);
      setTokenUsageStatus('error');
      setTokenUsageError(MANAGEMENT_TOKEN_USAGE_LOAD_ERROR_MESSAGE);
      return;
    }

    setTokenUsage(parsed);
    setTokenUsageStatus('success');
  };

  useEffect(() => {
    loadTokenUsage(tokenUsageDays).catch((loadError: unknown) => {
      setTokenUsage(null);
      setTokenUsageStatus('error');
      setTokenUsageError(loadError instanceof Error ? loadError.message : MANAGEMENT_TOKEN_USAGE_LOAD_ERROR_MESSAGE);
    });
  }, [tokenUsageDays]);

  return (
    <main className="management-page">
      <section className="management-header">
        <div>
          <p className="management-eyebrow">Analytics</p>
          <div className="management-title-row">
            <Link
              to="/management"
              className="management-back-icon-button"
              aria-label="Back to management home"
              title="Management home"
            >
              <img src={iconArrowRight} alt="" aria-hidden="true" className="management-back-icon" />
            </Link>
            <h1>API analytics</h1>
          </div>
          <p className="management-subtitle">Track model usage, token volume, and request sources.</p>
        </div>
      </section>

      <TokenUsageGraph
        usage={tokenUsage}
        status={tokenUsageStatus}
        error={tokenUsageError}
        selectedDays={tokenUsageDays}
        onSelectedDaysChange={setTokenUsageDays}
      />
    </main>
  );
};
