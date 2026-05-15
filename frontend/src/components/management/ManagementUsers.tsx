import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import iconArrowRight from '../../assets/icon-arrow-right.svg';
import { apiFetch } from '../../lib/apiClient';
import {
  ADMIN_PROMOTE_PATH,
  MANAGEMENT_DELETE_ERROR_MESSAGE,
  MANAGEMENT_DEMOTE_ERROR_MESSAGE,
  MANAGEMENT_LOAD_ERROR_MESSAGE,
  MANAGEMENT_PROMOTE_ERROR_MESSAGE,
  MANAGEMENT_USERS_PAGE_SIZE,
} from './management.consts';
import type {
  AdminUsersPagination,
  AdminUserSummary,
  ManagementProps,
  ManagementStatus,
  ManagementUserAction,
} from './management.types';
import {
  buildAdminUsersUrl,
  buildDeleteUserUrl,
  buildDemoteAdminUrl,
  parseAdminUsersResult,
  readManagementErrorMessage,
} from './management.utils';
import { DeleteUserDialog } from './DeleteUserDialog';
import './Management.css';

const DEFAULT_USERS_PAGINATION: AdminUsersPagination = {
  page: 1,
  pageSize: MANAGEMENT_USERS_PAGE_SIZE,
  total: 0,
  totalPages: 0,
  hasNextPage: false,
  hasPreviousPage: false,
};

const formatNumber = (value: number): string => new Intl.NumberFormat('en-US').format(value);

export const ManagementUsers = ({ currentUser }: ManagementProps) => {
  const [query, setQuery] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [pagination, setPagination] = useState<AdminUsersPagination>(DEFAULT_USERS_PAGINATION);
  const [status, setStatus] = useState<ManagementStatus>('loading');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [activeAction, setActiveAction] = useState<{ userId: string; action: ManagementUserAction } | null>(null);
  const [pendingDeleteUser, setPendingDeleteUser] = useState<AdminUserSummary | null>(null);

  const loadUsers = async (searchQuery: string, page: number): Promise<void> => {
    setStatus('loading');
    setError('');
    setSuccessMessage('');

    const response = await apiFetch(buildAdminUsersUrl(searchQuery, page));
    if (!response.ok) {
      setUsers([]);
      setPagination(DEFAULT_USERS_PAGINATION);
      setStatus('error');
      setError(await readManagementErrorMessage(response, MANAGEMENT_LOAD_ERROR_MESSAGE));
      return;
    }

    const payload: unknown = await response.json().catch(() => null);
    const parsed = parseAdminUsersResult(payload);
    if (!parsed) {
      setUsers([]);
      setPagination(DEFAULT_USERS_PAGINATION);
      setStatus('error');
      setError(MANAGEMENT_LOAD_ERROR_MESSAGE);
      return;
    }

    setUsers(parsed.users);
    setPagination(parsed.pagination);
    setStatus('success');
  };

  useEffect(() => {
    loadUsers('', 1).catch((loadError: unknown) => {
      setUsers([]);
      setPagination(DEFAULT_USERS_PAGINATION);
      setStatus('error');
      setError(loadError instanceof Error ? loadError.message : MANAGEMENT_LOAD_ERROR_MESSAGE);
    });
  }, []);

  const handleSearch = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const nextQuery = query.trim();
    setActiveQuery(nextQuery);
    setQuery(nextQuery);
    loadUsers(nextQuery, 1).catch((loadError: unknown) => {
      setUsers([]);
      setPagination(DEFAULT_USERS_PAGINATION);
      setStatus('error');
      setError(loadError instanceof Error ? loadError.message : MANAGEMENT_LOAD_ERROR_MESSAGE);
    });
  };

  const handlePageChange = (page: number): void => {
    loadUsers(activeQuery, page).catch((loadError: unknown) => {
      setUsers([]);
      setPagination(DEFAULT_USERS_PAGINATION);
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
      currentUsers.map((currentUser) => currentUser.email === email ? { ...currentUser, role: 'admin' } : currentUser)
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
      currentUsers.map((currentUser) => currentUser.id === user.id ? { ...currentUser, role: 'user' } : currentUser)
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

    await loadUsers(activeQuery, pagination.page);
    setSuccessMessage(`${user.firstName} ${user.lastName} was deleted.`);
    setPendingDeleteUser(null);
    setActiveAction(null);
  };

  const isDeletingPendingUser =
    pendingDeleteUser !== null &&
    activeAction?.userId === pendingDeleteUser.id &&
    activeAction.action === 'delete';
  const displayedTotalPages = Math.max(1, pagination.totalPages);

  return (
    <main className="management-page">
      <section className="management-header">
        <div>
          <p className="management-eyebrow">Admin tools</p>
          <div className="management-title-row">
            <Link
              to="/management"
              className="management-back-icon-button"
              aria-label="Back to management home"
              title="Management home"
            >
              <img src={iconArrowRight} alt="" aria-hidden="true" className="management-back-icon" />
            </Link>
            <h1>Users</h1>
          </div>
          <p className="management-subtitle">Search existing users and manage admin access.</p>
        </div>
      </section>

      {error && <p className="management-alert management-alert--error">{error}</p>}
      {successMessage && <p className="management-alert management-alert--success">{successMessage}</p>}

      <section className="management-users" aria-label="Users">
        <div className="management-users-header">
          <div>
            <p className="management-eyebrow">Users</p>
            <h2>User list</h2>
            <p className="management-subtitle">
              {status === 'success'
                ? `${formatNumber(pagination.total)} user${pagination.total === 1 ? '' : 's'} found`
                : 'Search existing users and grant admin access.'}
            </p>
          </div>
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
        </div>

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
          <>
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

            <div className="management-pagination" aria-label="User list pagination">
              <span>
                Page {pagination.page} of {displayedTotalPages} - {formatNumber(pagination.total)} total
              </span>
              <div className="management-pagination-actions">
                <button
                  type="button"
                  className="btn-outline management-pagination-button"
                  disabled={!pagination.hasPreviousPage}
                  onClick={() => handlePageChange(pagination.page - 1)}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="btn-outline management-pagination-button"
                  disabled={!pagination.hasNextPage}
                  onClick={() => handlePageChange(pagination.page + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          </>
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
