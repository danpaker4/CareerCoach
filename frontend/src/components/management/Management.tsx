import { useEffect, useState, type FormEvent } from 'react';
import { apiFetch } from '../../lib/apiClient';
import {
  ADMIN_PROMOTE_PATH,
  MANAGEMENT_DELETE_ERROR_MESSAGE,
  MANAGEMENT_DEMOTE_ERROR_MESSAGE,
  MANAGEMENT_LOAD_ERROR_MESSAGE,
  MANAGEMENT_PROMOTE_ERROR_MESSAGE,
  MANAGEMENT_TOKEN_USAGE_LOAD_ERROR_MESSAGE,
} from './management.consts';
import type { AdminLlmTokenUsageResult, AdminUserSummary, ManagementProps, ManagementStatus, ManagementUserAction, TokenUsageStatus } from './management.types';
import {
  buildAdminLlmTokenUsageUrl,
  buildAdminUsersUrl,
  buildDeleteUserUrl,
  buildDemoteAdminUrl,
  parseTokenUsage,
  parseAdminUsers,
  readManagementErrorMessage,
} from './management.utils';
import { DeleteUserDialog } from './DeleteUserDialog';
import { TokenUsageGraph } from './TokenUsageGraph';
import './Management.css';

export const Management = ({ currentUser }: ManagementProps) => {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [status, setStatus] = useState<ManagementStatus>('loading');
  const [tokenUsageStatus, setTokenUsageStatus] = useState<TokenUsageStatus>('loading');
  const [tokenUsage, setTokenUsage] = useState<AdminLlmTokenUsageResult | null>(null);
  const [tokenUsageError, setTokenUsageError] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [activeAction, setActiveAction] = useState<{ userId: string; action: ManagementUserAction } | null>(null);
  const [pendingDeleteUser, setPendingDeleteUser] = useState<AdminUserSummary | null>(null);

  const loadUsers = async (searchQuery: string): Promise<void> => {
    setStatus('loading');
    setError('');
    setSuccessMessage('');

    const response = await apiFetch(buildAdminUsersUrl(searchQuery));
    if (!response.ok) {
      setUsers([]);
      setStatus('error');
      setError(await readManagementErrorMessage(response, MANAGEMENT_LOAD_ERROR_MESSAGE));
      return;
    }

    const payload: unknown = await response.json().catch(() => []);
    setUsers(parseAdminUsers(payload));
    setStatus('success');
  };

  const loadTokenUsage = async (): Promise<void> => {
    setTokenUsageStatus('loading');
    setTokenUsageError('');

    const response = await apiFetch(buildAdminLlmTokenUsageUrl());
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
    loadUsers('').catch((loadError: unknown) => {
      setUsers([]);
      setStatus('error');
      setError(loadError instanceof Error ? loadError.message : MANAGEMENT_LOAD_ERROR_MESSAGE);
    });
    loadTokenUsage().catch((loadError: unknown) => {
      setTokenUsage(null);
      setTokenUsageStatus('error');
      setTokenUsageError(loadError instanceof Error ? loadError.message : MANAGEMENT_TOKEN_USAGE_LOAD_ERROR_MESSAGE);
    });
  }, []);

  const handleSearch = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    loadUsers(query).catch((loadError: unknown) => {
      setUsers([]);
      setStatus('error');
      setError(loadError instanceof Error ? loadError.message : MANAGEMENT_LOAD_ERROR_MESSAGE);
    });
  };

  const handlePromote = async (email: string): Promise<void> => {
    const user = users.find((currentUserItem) => currentUserItem.email === email);
    if (!user) {
      return;
    }

    setActiveAction({ userId: user.id, action: 'promote' });
    setError('');
    setSuccessMessage('');

    const response = await apiFetch(ADMIN_PROMOTE_PATH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      setActiveAction(null);
      setError(await readManagementErrorMessage(response, MANAGEMENT_PROMOTE_ERROR_MESSAGE));
      return;
    }

    setUsers((currentUsers) =>
      currentUsers.map((user) => user.email === email ? { ...user, role: 'admin' } : user)
    );
    setSuccessMessage(`${user.firstName} is now an admin.`);
    setActiveAction(null);
  };

  const handleDemote = async (user: AdminUserSummary): Promise<void> => {
    setActiveAction({ userId: user.id, action: 'demote' });
    setError('');
    setSuccessMessage('');

    const response = await apiFetch(buildDemoteAdminUrl(user.id), { method: 'DELETE' });
    if (!response.ok) {
      setActiveAction(null);
      setError(await readManagementErrorMessage(response, MANAGEMENT_DEMOTE_ERROR_MESSAGE));
      return;
    }

    setUsers((currentUsers) =>
      currentUsers.map((currentUserItem) =>
        currentUserItem.id === user.id ? { ...currentUserItem, role: 'user' } : currentUserItem
      )
    );
    setSuccessMessage(`${user.firstName} is now a regular user.`);
    setActiveAction(null);
  };

  const handleDelete = async (user: AdminUserSummary): Promise<void> => {
    setActiveAction({ userId: user.id, action: 'delete' });
    setError('');
    setSuccessMessage('');

    const response = await apiFetch(buildDeleteUserUrl(user.id), { method: 'DELETE' });
    if (!response.ok) {
      setActiveAction(null);
      setPendingDeleteUser(null);
      setError(await readManagementErrorMessage(response, MANAGEMENT_DELETE_ERROR_MESSAGE));
      return;
    }

    setUsers((currentUsers) => currentUsers.filter((currentUserItem) => currentUserItem.id !== user.id));
    setSuccessMessage(`${user.firstName} ${user.lastName} was deleted.`);
    setPendingDeleteUser(null);
    setActiveAction(null);
  };

  const isDeletingPendingUser =
    pendingDeleteUser !== null &&
    activeAction?.userId === pendingDeleteUser.id &&
    activeAction.action === 'delete';

  return (
    <main className="management-page">
      <section className="management-header">
        <div>
          <p className="management-eyebrow">Admin tools</p>
          <h1>Management</h1>
          <p className="management-subtitle">Search existing users and grant admin access.</p>
        </div>
      </section>

      <section className="management-controls" aria-label="User search">
        <form className="management-search" onSubmit={handleSearch}>
          <label htmlFor="management-user-search">Find user</label>
          <div className="management-search-row">
            <input
              id="management-user-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by email or name"
            />
            <button type="submit" className="btn-primary" disabled={status === 'loading'}>
              {status === 'loading' ? 'Searching...' : 'Search'}
            </button>
          </div>
        </form>
      </section>

      <TokenUsageGraph usage={tokenUsage} status={tokenUsageStatus} error={tokenUsageError} />

      {error && <p className="management-alert management-alert--error">{error}</p>}
      {successMessage && <p className="management-alert management-alert--success">{successMessage}</p>}

      <section className="management-users" aria-label="Users">
        {status === 'loading' && (
          <div className="page-loading management-state">
            <div className="spinner" />
            <p>Loading users...</p>
          </div>
        )}

        {status !== 'loading' && users.length === 0 && (
          <div className="page-empty management-state">
            <p>No users found.</p>
          </div>
        )}

        {status !== 'loading' && users.length > 0 && (
          <div className="management-table-wrap">
            <table className="management-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <span className="management-user-name">{user.firstName} {user.lastName}</span>
                    </td>
                    <td>{user.email}</td>
                    <td>
                      <span className={`management-role management-role--${user.role}`}>{user.role}</span>
                    </td>
                    <td>
                      <div className="management-actions">
                        {user.role === 'admin' ? (
                          <button
                            type="button"
                            className="btn-outline management-action-button"
                            disabled={user.id === currentUser.id || activeAction !== null}
                            onClick={() => {
                              handleDemote(user).catch((demoteError: unknown) => {
                                setActiveAction(null);
                                setError(demoteError instanceof Error ? demoteError.message : MANAGEMENT_DEMOTE_ERROR_MESSAGE);
                              });
                            }}
                          >
                            {activeAction?.userId === user.id && activeAction.action === 'demote' ? 'Demoting...' : 'Demote'}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn-outline management-action-button"
                            disabled={activeAction !== null}
                            onClick={() => {
                              handlePromote(user.email).catch((promoteError: unknown) => {
                                setActiveAction(null);
                                setError(promoteError instanceof Error ? promoteError.message : MANAGEMENT_PROMOTE_ERROR_MESSAGE);
                              });
                            }}
                          >
                            {activeAction?.userId === user.id && activeAction.action === 'promote'
                              ? 'Promoting...'
                              : 'Make admin'}
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn-outline management-action-button management-action-button--danger"
                          disabled={user.id === currentUser.id || activeAction !== null}
                          onClick={() => setPendingDeleteUser(user)}
                        >
                          {activeAction?.userId === user.id && activeAction.action === 'delete' ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {pendingDeleteUser && (
        <DeleteUserDialog
          user={pendingDeleteUser}
          isDeleting={isDeletingPendingUser}
          onCancel={() => setPendingDeleteUser(null)}
          onConfirm={() => {
            handleDelete(pendingDeleteUser).catch((deleteError: unknown) => {
              setActiveAction(null);
              setPendingDeleteUser(null);
              setError(deleteError instanceof Error ? deleteError.message : MANAGEMENT_DELETE_ERROR_MESSAGE);
            });
          }}
        />
      )}
    </main>
  );
};
