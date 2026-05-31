import { useEffect, useState, type ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import iconArrowRight from '../../assets/icon-arrow-right.svg';
import iconReset from '../../assets/icon-reset.svg';
import { apiFetch } from '../../lib/apiClient';
import {
  MANAGEMENT_RATE_LIMIT_LOAD_ERROR_MESSAGE,
  MANAGEMENT_RATE_LIMIT_SAVE_ERROR_MESSAGE,
} from './management.consts';
import type { ChatRateLimitConfig, ChatRateLimitRuleKey, ManagementStatus } from './management.types';
import {
  buildRateLimitConfigPayload,
  CHAT_RATE_LIMIT_RULE_DESCRIPTIONS,
  CHAT_RATE_LIMIT_RULE_KEYS,
  CHAT_RATE_LIMIT_RULE_LABELS,
  CHAT_RATE_LIMIT_RULE_MEANINGS,
  parseChatRateLimitConfig,
  rateLimitConfigUrl,
  readManagementErrorMessage,
} from './management.utils';
import './Management.css';

const getUpdatedByLabel = (config: ChatRateLimitConfig): string | null =>
  config.updatedByAdminUserName ?? config.updatedByAdminUserEmail ?? config.updatedByAdminUserId ?? null;

const formatUpdatedAt = (value: string): string => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

const updateRuleEnabled = (
  config: ChatRateLimitConfig,
  ruleKey: ChatRateLimitRuleKey,
  enabled: boolean,
): ChatRateLimitConfig => ({
  ...config,
  rules: {
    ...config.rules,
    [ruleKey]: {
      ...config.rules[ruleKey],
      enabled,
    },
  },
});

const updateRuleLimit = (
  config: ChatRateLimitConfig,
  ruleKey: ChatRateLimitRuleKey,
  limit: number,
): ChatRateLimitConfig => ({
  ...config,
  rules: {
    ...config.rules,
    [ruleKey]: {
      ...config.rules[ruleKey],
      limit,
    },
  },
});

export const ManagementRateLimits = () => {
  const [status, setStatus] = useState<ManagementStatus>('loading');
  const [config, setConfig] = useState<ChatRateLimitConfig | null>(null);
  const [draftConfig, setDraftConfig] = useState<ChatRateLimitConfig | null>(null);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const loadConfig = async (): Promise<void> => {
    setStatus('loading');
    setError('');
    setSuccessMessage('');

    const response = await apiFetch(rateLimitConfigUrl());
    if (!response.ok) {
      setConfig(null);
      setDraftConfig(null);
      setStatus('error');
      setError(await readManagementErrorMessage(response, MANAGEMENT_RATE_LIMIT_LOAD_ERROR_MESSAGE));
      return;
    }

    const payload: unknown = await response.json().catch(() => null);
    const parsed = parseChatRateLimitConfig(payload);
    if (!parsed) {
      setConfig(null);
      setDraftConfig(null);
      setStatus('error');
      setError(MANAGEMENT_RATE_LIMIT_LOAD_ERROR_MESSAGE);
      return;
    }

    setConfig(parsed);
    setDraftConfig(parsed);
    setStatus('success');
  };

  useEffect(() => {
    loadConfig().catch((loadError: unknown) => {
      setConfig(null);
      setDraftConfig(null);
      setStatus('error');
      setError(loadError instanceof Error ? loadError.message : MANAGEMENT_RATE_LIMIT_LOAD_ERROR_MESSAGE);
    });
  }, []);

  const handleEnabledChange = (ruleKey: ChatRateLimitRuleKey) =>
    (event: ChangeEvent<HTMLInputElement>): void => {
      setSuccessMessage('');
      setDraftConfig((currentConfig) => currentConfig
        ? updateRuleEnabled(currentConfig, ruleKey, event.target.checked)
        : currentConfig);
    };

  const handleLimitChange = (ruleKey: ChatRateLimitRuleKey) =>
    (event: ChangeEvent<HTMLInputElement>): void => {
      const parsedLimit = Math.trunc(Number(event.target.value));
      if (!Number.isFinite(parsedLimit)) {
        return;
      }

      setSuccessMessage('');
      setDraftConfig((currentConfig) => currentConfig
        ? updateRuleLimit(currentConfig, ruleKey, Math.max(1, parsedLimit))
        : currentConfig);
    };

  const handleSave = async (): Promise<void> => {
    if (!draftConfig) {
      return;
    }

    setIsSaving(true);
    setError('');
    setSuccessMessage('');

    const response = await apiFetch(rateLimitConfigUrl(), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildRateLimitConfigPayload(draftConfig)),
    });
    if (!response.ok) {
      setError(await readManagementErrorMessage(response, MANAGEMENT_RATE_LIMIT_SAVE_ERROR_MESSAGE));
      setIsSaving(false);
      return;
    }

    const payload: unknown = await response.json().catch(() => null);
    const parsed = parseChatRateLimitConfig(payload);
    if (!parsed) {
      setError(MANAGEMENT_RATE_LIMIT_SAVE_ERROR_MESSAGE);
      setIsSaving(false);
      return;
    }

    setConfig(parsed);
    setDraftConfig(parsed);
    setSuccessMessage('Rate limits saved.');
    setStatus('success');
    setIsSaving(false);
  };

  const hasChanges = JSON.stringify(config?.rules) !== JSON.stringify(draftConfig?.rules);

  return (
    <main className="management-page">
      <section className="management-header">
        <div>
          <p className="management-eyebrow">Controls</p>
          <div className="management-title-row">
            <Link
              to="/management"
              className="management-back-icon-button"
              aria-label="Back to management home"
              title="Management home"
            >
              <img src={iconArrowRight} alt="" aria-hidden="true" className="management-back-icon" />
            </Link>
            <h1>Chat rate limits</h1>
          </div>
          <p className="management-subtitle">Update live chat quotas and model-spend guardrails.</p>
        </div>

        <div className="management-rate-limit-actions">
          <button
            type="button"
            className="management-rate-limit-reset-button"
            onClick={() => {
              setDraftConfig(config);
              setSuccessMessage('');
              setError('');
            }}
            disabled={!hasChanges || isSaving}
            title="Reset unsaved changes"
          >
            <img src={iconReset} alt="" aria-hidden="true" className="management-rate-limit-reset-icon" />
            Reset
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              handleSave().catch((saveError: unknown) => {
                setError(saveError instanceof Error ? saveError.message : MANAGEMENT_RATE_LIMIT_SAVE_ERROR_MESSAGE);
                setIsSaving(false);
              });
            }}
            disabled={!draftConfig || !hasChanges || isSaving}
          >
            {isSaving ? 'Saving...' : 'Save limits'}
          </button>
        </div>
      </section>

      {error && <div className="management-alert management-alert--error">{error}</div>}
      {successMessage && <div className="management-alert management-alert--success">{successMessage}</div>}

      <section className="management-rate-limits">
        {status === 'loading' && <div className="management-state">Loading rate limits...</div>}
        {status !== 'loading' && draftConfig && (
          <>
            <div className="management-rate-limit-meta">
              <span>Last updated: {formatUpdatedAt(draftConfig.updatedAt)}</span>
              {getUpdatedByLabel(draftConfig) && <span>Updated by: {getUpdatedByLabel(draftConfig)}</span>}
            </div>

            <div className="management-table-wrap">
              <table className="management-table management-table--rate-limits">
                <thead>
                  <tr>
                    <th>Rule</th>
                    <th>Enabled</th>
                    <th>Limit</th>
                    <th>Meaning</th>
                  </tr>
                </thead>
                <tbody>
                  {CHAT_RATE_LIMIT_RULE_KEYS.map((ruleKey) => {
                    const rule = draftConfig.rules[ruleKey];
                    return (
                      <tr key={ruleKey}>
                        <td>
                          <strong className="management-rate-limit-name">{CHAT_RATE_LIMIT_RULE_LABELS[ruleKey]}</strong>
                          <span className="management-rate-limit-description">
                            {CHAT_RATE_LIMIT_RULE_DESCRIPTIONS[ruleKey]}
                          </span>
                        </td>
                        <td>
                          <label className="management-switch">
                            <input
                              type="checkbox"
                              checked={rule.enabled}
                              onChange={handleEnabledChange(ruleKey)}
                            />
                            <span>{rule.enabled ? 'On' : 'Off'}</span>
                          </label>
                        </td>
                        <td>
                          <input
                            className="management-rate-limit-input"
                            type="number"
                            min={1}
                            step={1}
                            value={rule.limit}
                            onChange={handleLimitChange(ruleKey)}
                          />
                        </td>
                        <td>{CHAT_RATE_LIMIT_RULE_MEANINGS[ruleKey]}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </main>
  );
};
