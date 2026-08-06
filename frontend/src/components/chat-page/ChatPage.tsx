import { useCallback, useEffect, useRef, useState } from 'react';
import { ChatInterface } from '../chat-component/Chat';
import type { User } from '../../types/user';
import type { ChatExportSnapshot, ChatInterfaceHandle, ConversationSummary } from '../chat-component/chat.types';
import { ENV } from '../../config';
import { apiFetch } from '../../lib/apiClient';
import { formatChatJsonExport } from '../chat-component/chat-export.utils';
import './ChatPage.css';

const MAX_CV_EXCERPT_CHARS = 4000;

const activeConversationStorageKey = (userId: string) => `careerCoach.chat.activeConversationId.${userId}`;

const isConversationSummary = (value: unknown): value is ConversationSummary => {
    if (typeof value !== 'object' || value === null) {
        return false;
    }
    const row = value as Record<string, unknown>;
    return (
        typeof row.conversationId === 'string'
        && row.conversationId.trim().length > 0
        && typeof row.updatedAt === 'string'
        && typeof row.previewText === 'string'
    );
};

const parseConversationList = (payload: unknown): ConversationSummary[] => {
    if (typeof payload !== 'object' || payload === null || !('conversations' in payload)) {
        return [];
    }
    const raw = (payload as { conversations: unknown }).conversations;
    if (!Array.isArray(raw)) {
        return [];
    }
    return raw.filter(isConversationSummary);
};

interface ChatPageProps {
  user: User;
}

const QUICK_PROMPTS = [
  'What skills should I learn for my next role?',
  'Review my career progress so far',
  'Suggest jobs that match my profile',
  'How can I improve my CV?',
  'Help me prepare for interviews',
];

export const ChatPage = ({ user }: ChatPageProps) => {
  const [tabs, setTabs] = useState<ConversationSummary[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [tabsLoading, setTabsLoading] = useState(true);
  const [createError, setCreateError] = useState<string | null>(null);
  const [exportSnapshot, setExportSnapshot] = useState<ChatExportSnapshot | null>(null);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copying' | 'copied' | 'error'>('idle');
  const [profileUser, setProfileUser] = useState(user);
  const chatRef = useRef<ChatInterfaceHandle>(null);

  useEffect(() => {
    setProfileUser(user);
  }, [user]);

  const userProfile = {
    firstName: profileUser.firstName,
    lastName: profileUser.lastName,
    currentJob: profileUser.currentJob,
    achievements: profileUser.achievements,
    technologies: profileUser.technologies,
    interests: profileUser.interests,
    githubSkills: profileUser.githubSkills,
    knownSkills: profileUser.knownSkills,
    cvExcerpt: (() => {
      const fromText = typeof profileUser.cvText === 'string' ? profileUser.cvText.trim() : '';
      if (fromText.length > 0) {
        return fromText.slice(0, MAX_CV_EXCERPT_CHARS);
      }
      const fromCv = typeof profileUser.cv === 'string' ? profileUser.cv.trim() : '';
      if (fromCv.length === 0 || /^s3:\/\//i.test(fromCv) || /^uploads\/cv\//i.test(fromCv)) {
        return undefined;
      }
      return fromCv.slice(0, MAX_CV_EXCERPT_CHARS);
    })(),
  } as const;

  const activeExportSnapshot = exportSnapshot?.conversationId === activeConversationId ? exportSnapshot : null;
  const copyChatJsonDisabled = !activeExportSnapshot || activeExportSnapshot.messages.length === 0 || copyStatus === 'copying';
  const copyChatJsonLabel = copyStatus === 'copied'
    ? 'Copied'
    : copyStatus === 'copying'
      ? 'Copying...'
      : copyStatus === 'error'
        ? 'Copy failed'
        : 'Copy JSON';

  const handleExportSnapshotChange = useCallback((snapshot: ChatExportSnapshot): void => {
    setExportSnapshot(snapshot);
    setCopyStatus((currentStatus) => currentStatus === 'copying' ? currentStatus : 'idle');
  }, []);

  const handleCopyChatJson = useCallback(async (): Promise<void> => {
    if (!activeExportSnapshot) {
      return;
    }

    setCopyStatus('copying');

    try {
      await navigator.clipboard.writeText(formatChatJsonExport(activeExportSnapshot.conversationId, activeExportSnapshot.messages));
      setCopyStatus('copied');
    } catch {
      setCopyStatus('error');
    }
  }, [activeExportSnapshot]);

  const refreshConversationTabs = useCallback(async (): Promise<ConversationSummary[]> => {
    const response = await apiFetch(`${ENV.CHAT_SERVICE_BASE_URL}/chat/users/${encodeURIComponent(user.id)}/conversations`);
    if (!response.ok) {
      return [];
    }
    const payload: unknown = await response.json().catch(() => null);
    return parseConversationList(payload);
  }, [user.id]);

  useEffect(() => {
    const bootstrap = async () => {
      setTabsLoading(true);
      setCreateError(null);
      try {
        const firstList = await refreshConversationTabs();
        if (firstList.length === 0) {
          await apiFetch(`${ENV.CHAT_SERVICE_BASE_URL}/chat/${encodeURIComponent(user.id)}`);
        }
        const list = firstList.length > 0 ? firstList : await refreshConversationTabs();
        setTabs(list);
        const stored = sessionStorage.getItem(activeConversationStorageKey(user.id));
        const preferred = stored && list.some((item) => item.conversationId === stored) ? stored : null;
        const nextActive = preferred ?? list[0]?.conversationId ?? null;
        setActiveConversationId(nextActive);
        if (nextActive) {
          sessionStorage.setItem(activeConversationStorageKey(user.id), nextActive);
        }
      } finally {
        setTabsLoading(false);
      }
    };
    bootstrap().catch(() => setTabsLoading(false));
  }, [user.id, refreshConversationTabs]);

  useEffect(() => {
    setCopyStatus('idle');
    setExportSnapshot(null);
  }, [activeConversationId]);

  useEffect(() => {
    if (copyStatus !== 'copied') {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => setCopyStatus('idle'), 2000);
    return () => window.clearTimeout(timeoutId);
  }, [copyStatus]);

  const selectTab = (conversationId: string) => {
    setActiveConversationId(conversationId);
    sessionStorage.setItem(activeConversationStorageKey(user.id), conversationId);
  };

  const handleNewChat = async () => {
    setCreateError(null);
    const response = await apiFetch(`${ENV.CHAT_SERVICE_BASE_URL}/chat/users/${encodeURIComponent(user.id)}/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userProfile }),
    });
    if (!response.ok) {
      setCreateError('Could not start a new chat. Please try again.');
      return;
    }
    const payload: unknown = await response.json().catch(() => null);
    const record = typeof payload === 'object' && payload !== null ? (payload as Record<string, unknown>) : null;
    const newId = record && typeof record.conversationId === 'string' ? record.conversationId : null;
    const updated = await refreshConversationTabs();
    setTabs(updated.length > 0 ? updated : newId ? [{ conversationId: newId, updatedAt: new Date().toISOString(), previewText: 'New chat' }] : []);
    if (newId) {
      selectTab(newId);
    }
  };

  const handleDeleteChat = async (conversationId: string) => {
    setCreateError(null);
    const response = await apiFetch(
      `${ENV.CHAT_SERVICE_BASE_URL}/chat/users/${encodeURIComponent(user.id)}/conversations/${encodeURIComponent(conversationId)}`,
      { method: 'DELETE' }
    );
    if (!response.ok) {
      setCreateError('Could not delete this chat. Please try again.');
      return;
    }
    let nextList = await refreshConversationTabs();
    if (nextList.length === 0) {
      await apiFetch(`${ENV.CHAT_SERVICE_BASE_URL}/chat/${encodeURIComponent(user.id)}`);
      nextList = await refreshConversationTabs();
    }
    setTabs(nextList);
    if (conversationId === activeConversationId) {
      const nextActive = nextList[0]?.conversationId ?? null;
      setActiveConversationId(nextActive);
      if (nextActive) {
        sessionStorage.setItem(activeConversationStorageKey(user.id), nextActive);
      } else {
        sessionStorage.removeItem(activeConversationStorageKey(user.id));
      }
    }
  };

  return (
    <div className="chat-page">

      {/* Sidebar */}
      <aside className="chat-sidebar">
        <div className="chat-sidebar-header">
          <div className="chat-coach-avatar" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 8.5-8.5h.5a8.5 8.5 0 0 1 8 8v.5z" />
            </svg>
          </div>
          <div>
            <p className="chat-coach-name">AI Career Coach</p>
            <p className="chat-coach-status">
              <span className="chat-status-dot" />
              Online
            </p>
          </div>
        </div>
        <div className="chat-quick-prompts">
          <p className="chat-sidebar-label">Quick prompts</p>
          <div className="chat-prompt-list">
            {QUICK_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                className="chat-prompt-btn"
                onClick={() => {
                  chatRef.current?.sendPrompt(prompt);
                }}
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      </aside>

      {/* Main chat area */}
      <main className="chat-main">
        <div className="chat-main-header">
          <div className="chat-main-title">
            <div>
              <h1 className="chat-main-heading">AI Career Coach</h1>
              <p className="chat-main-sub">Ask me anything about your career, skills, or job search</p>
            </div>
            <button
              type="button"
              className={`chat-export-json-button${copyStatus === 'error' ? ' chat-export-json-button--error' : ''}`}
              onClick={() => {
                handleCopyChatJson().catch(() => setCopyStatus('error'));
              }}
              disabled={copyChatJsonDisabled}
              aria-label="Copy current chat as JSON"
            >
              {copyChatJsonLabel}
            </button>
          </div>
        </div>

        <div className="chat-tabs-bar" role="tablist" aria-label="Conversations">
          {tabs.map((tab) => {
            const isActive = tab.conversationId === activeConversationId;
            const raw = tab.previewText.trim();
            const label = raw.length > 28 ? `${raw.slice(0, 28)}…` : (raw.length > 0 ? raw : 'Chat');
            return (
              <div
                key={tab.conversationId}
                className={`chat-tab-row ${isActive ? 'chat-tab-row--active' : ''}`}
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  className={`chat-tab ${isActive ? 'chat-tab--active' : ''}`}
                  onClick={() => selectTab(tab.conversationId)}
                >
                  {label}
                </button>
                <button
                  type="button"
                  className="chat-tab-delete"
                  aria-label={`Delete conversation ${label}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    handleDeleteChat(tab.conversationId).catch(() => setCreateError('Could not delete this chat.'));
                  }}
                >
                  ×
                </button>
              </div>
            );
          })}
          <button type="button" className="chat-tab chat-tab--new" onClick={() => { handleNewChat().catch(() => setCreateError('Could not start a new chat.')); }}>
            + New chat
          </button>
        </div>
        {createError ? <p className="chat-tabs-error" role="alert">{createError}</p> : null}

        <div className="chat-interface-wrap">
          {tabsLoading || !activeConversationId ? (
            <div className="chat-loading-placeholder">Loading your conversations…</div>
          ) : (
            <ChatInterface
              ref={chatRef}
              key={activeConversationId}
              userId={user.id}
              conversationId={activeConversationId}
              onExportSnapshotChange={handleExportSnapshotChange}
              onUserUpdated={setProfileUser}
              userProfile={userProfile}
            />
          )}
        </div>
      </main>

    </div>
  );
};
