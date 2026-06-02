import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ENV } from '../../config';
import { apiFetch } from '../../lib/apiClient';
import './NotificationBell.css';

interface NotificationBellProps {
  userId: string;
}

interface NotificationItem {
  id: string;
  userId: string;
  type: 'wanted_job_match' | 'pipeline_reminder' | 'system';
  title: string;
  message: string;
  actionUrl?: string;
  read: boolean;
  createdAt: string;
}

const POLL_INTERVAL_MS = 30_000;
const PIPELINE_CHECK_INTERVAL_MS = 5 * 60_000;

const parseList = (data: unknown): NotificationItem[] => {
  if (!Array.isArray(data)) return [];
  return data.filter((item): item is NotificationItem => {
    if (typeof item !== 'object' || item === null) return false;
    const obj = item as Record<string, unknown>;
    return (
      typeof obj.id === 'string' &&
      typeof obj.userId === 'string' &&
      typeof obj.type === 'string' &&
      typeof obj.title === 'string' &&
      typeof obj.message === 'string' &&
      typeof obj.read === 'boolean' &&
      typeof obj.createdAt === 'string'
    );
  });
};

const formatRelative = (iso: string): string => {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms)) return '';
  const m = Math.floor(ms / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
};

const typeIcon = (type: NotificationItem['type']): string => {
  if (type === 'wanted_job_match') return '✦';
  if (type === 'pipeline_reminder') return '⏰';
  return '·';
};

export const NotificationBell = ({ userId }: NotificationBellProps) => {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastPipelineCheckRef = useRef(0);

  const fetchUnread = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await apiFetch(`${ENV.JOB_SERVICE_BASE_URL}/notifications/${userId}/unread-count`, {
        credentials: 'include',
      });
      if (!res.ok) return;
      const data = await res.json() as { unread?: number };
      if (typeof data.unread === 'number') setUnread(data.unread);
    } catch {
      // silent: bell badge is best-effort
    }
  }, [userId]);

  const fetchList = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await apiFetch(`${ENV.JOB_SERVICE_BASE_URL}/notifications/${userId}?limit=30`, {
        credentials: 'include',
      });
      if (!res.ok) return;
      const data: unknown = await res.json();
      setItems(parseList(data));
    } catch {
      // silent
    }
  }, [userId]);

  const checkPipelineReminders = useCallback(async () => {
    if (!userId) return;
    const now = Date.now();
    if (now - lastPipelineCheckRef.current < PIPELINE_CHECK_INTERVAL_MS) return;
    lastPipelineCheckRef.current = now;
    try {
      await apiFetch(`${ENV.JOB_SERVICE_BASE_URL}/notifications/${userId}/check-pipeline-reminders`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // silent
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    void fetchUnread();
    void checkPipelineReminders();
    const interval = window.setInterval(() => {
      void fetchUnread();
      void checkPipelineReminders();
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [userId, fetchUnread, checkPipelineReminders]);

  useEffect(() => {
    if (open) {
      void fetchList();
      void fetchUnread();
    }
  }, [open, fetchList, fetchUnread]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const handleMarkRead = async (id: string) => {
    try {
      const res = await apiFetch(`${ENV.JOB_SERVICE_BASE_URL}/notifications/${id}/read`, {
        method: 'PATCH',
        credentials: 'include',
      });
      if (res.ok) {
        setItems((prev) => prev.map((item) => (item.id === id ? { ...item, read: true } : item)));
        await fetchUnread();
      }
    } catch {
      // silent
    }
  };

  const handleDismiss = async (id: string) => {
    try {
      const res = await apiFetch(`${ENV.JOB_SERVICE_BASE_URL}/notifications/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok || res.status === 404) {
        setItems((prev) => prev.filter((item) => item.id !== id));
        await fetchUnread();
      }
    } catch {
      // silent
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const res = await apiFetch(`${ENV.JOB_SERVICE_BASE_URL}/notifications/${userId}/read-all`, {
        method: 'PATCH',
        credentials: 'include',
      });
      if (res.ok) {
        setItems((prev) => prev.map((item) => ({ ...item, read: true })));
        setUnread(0);
      }
    } catch {
      // silent
    }
  };

  if (!userId) return null;
  const badge = unread > 9 ? '9+' : String(unread);
  const hasUnread = unread > 0;

  return (
    <div className="notification-bell" ref={containerRef}>
      <button
        type="button"
        className={`notification-bell-button${hasUnread ? ' notification-bell-button--has-unread' : ''}`}
        onClick={() => setOpen((prev) => !prev)}
        aria-label={`Notifications${hasUnread ? ` (${unread} unread)` : ''}`}
        aria-expanded={open}
      >
        <svg className="notification-bell-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {hasUnread && <span className="notification-bell-badge">{badge}</span>}
      </button>

      {open && (
        <div className="notification-panel" role="dialog" aria-label="Notifications">
          <header className="notification-panel-header">
            <h3>Notifications</h3>
            {hasUnread && (
              <button type="button" className="notification-mark-all" onClick={() => void handleMarkAllRead()}>
                Mark all read
              </button>
            )}
          </header>
          <div className="notification-panel-body">
            {items.length === 0 ? (
              <p className="notification-empty">You're all caught up.</p>
            ) : (
              <ul className="notification-list">
                {items.map((item) => {
                  const body = (
                    <>
                      <div className="notification-row-top">
                        <span className="notification-type-icon" aria-hidden="true">{typeIcon(item.type)}</span>
                        <span className="notification-title">{item.title}</span>
                        {!item.read && <span className="notification-dot" aria-hidden="true" />}
                      </div>
                      <p className="notification-message">{item.message}</p>
                      <span className="notification-time">{formatRelative(item.createdAt)}</span>
                    </>
                  );
                  return (
                    <li key={item.id} className={`notification-row${item.read ? '' : ' notification-row--unread'}`}>
                      {item.actionUrl ? (
                        <Link
                          to={item.actionUrl}
                          className="notification-row-link"
                          onClick={() => {
                            void handleMarkRead(item.id);
                            setOpen(false);
                          }}
                        >
                          {body}
                        </Link>
                      ) : (
                        <button
                          type="button"
                          className="notification-row-link"
                          onClick={() => void handleMarkRead(item.id)}
                        >
                          {body}
                        </button>
                      )}
                      <button
                        type="button"
                        className="notification-dismiss"
                        onClick={() => void handleDismiss(item.id)}
                        aria-label={`Dismiss ${item.title}`}
                        title="Dismiss"
                      >
                        ×
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
