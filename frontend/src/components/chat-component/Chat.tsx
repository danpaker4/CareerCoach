import { useState, useEffect, useRef, useCallback, type ChangeEvent, type KeyboardEvent } from 'react';
import './Chat.css';
import { ENV } from '../../config';
import { apiFetch } from '../../lib/apiClient';
import { getStoredAccessToken } from '../../lib/authSession';
import type {
    ChatProps,
    ChatQueuedResponse,
    ChatRequestEvent,
    ChatRequestResponse,
    ChatResponse,
    ConversationResponse,
    Message,
} from './chat.types';

const HTTP_TOO_MANY_REQUESTS = 429;
const HTTP_ACCEPTED = 202;
const CHAT_REQUEST_POLL_INTERVAL_MS = 2_000;
const CHAT_REQUEST_POLL_ATTEMPTS = 45;
const CHAT_REQUEST_WEBSOCKET_TIMEOUT_MS = 25_000;

type PendingRequestHandler = {
    readonly resolve: (response: ChatResponse) => void;
    readonly reject: (error: Error) => void;
};

const createMessage = (role: Message['role'], content: string, jobs?: Message['jobs']): Message => ({
    id: crypto.randomUUID(),
    role,
    content,
    ...(jobs && jobs.length > 0 ? { jobs } : {}),
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null;

const parseChatResponsePayload = (payload: unknown): ChatResponse => {
    if (typeof payload !== 'object' || payload === null) {
        return {};
    }
    const record = payload as Record<string, unknown>;
    const parsedJobs = Array.isArray(record.jobs)
        ? record.jobs.filter((item): item is NonNullable<ChatResponse['jobs']>[number] => {
            if (typeof item !== 'object' || item === null) {
                return false;
            }
            const job = item as Record<string, unknown>;
            const companyOk = !('company' in job) || typeof job.company === 'string';
            const salaryOk = !('salary' in job) || typeof job.salary === 'number';
            return typeof job.id === 'string'
                && typeof job.title === 'string'
                && typeof job.url === 'string'
                && typeof job.seniority === 'string'
                && typeof job.description === 'string'
                && companyOk
                && (salaryOk || job.salary === null);
        })
        : [];
    const parsedMatches = Array.isArray(record.jobMatches)
        ? record.jobMatches.filter((item): item is NonNullable<ChatResponse['jobMatches']>[number] => {
            if (typeof item !== 'object' || item === null) {
                return false;
            }
            const match = item as Record<string, unknown>;
            return typeof match.jobId === 'string'
                && typeof match.title === 'string'
                && typeof match.matchScore === 'number';
        })
        : [];
    return {
        reply: typeof record.reply === 'string' ? record.reply : undefined,
        jobs: parsedJobs,
        jobMatches: parsedMatches,
    };
};

const readChatResponse = async (response: Response): Promise<ChatResponse> => {
    const payload: unknown = await response.json().catch(() => ({}));
    return parseChatResponsePayload(payload);
};

const isChatQueuedResponse = (value: unknown): value is ChatQueuedResponse => {
    if (!isRecord(value)) {
        return false;
    }

    return typeof value.requestId === 'string'
        && typeof value.conversationId === 'string'
        && value.status === 'queued';
};

const readQueuedResponse = async (response: Response): Promise<ChatQueuedResponse | null> => {
    const payload: unknown = await response.json().catch(() => null);
    return isChatQueuedResponse(payload) ? payload : null;
};

const isChatRequestResponse = (value: unknown): value is ChatRequestResponse => {
    if (!isRecord(value)) {
        return false;
    }

    return typeof value.requestId === 'string'
        && typeof value.userId === 'string'
        && typeof value.conversationId === 'string'
        && (value.status === 'queued' || value.status === 'started' || value.status === 'completed' || value.status === 'failed')
        && typeof value.createdAt === 'string'
        && typeof value.updatedAt === 'string'
        && typeof value.queuedAt === 'string'
        && (value.response === undefined || isRecord(value.response))
        && (value.error === undefined || typeof value.error === 'string');
};

const readChatRequestResponse = async (response: Response): Promise<ChatRequestResponse | null> => {
    const payload: unknown = await response.json().catch(() => null);
    return isChatRequestResponse(payload)
        ? { ...payload, response: payload.response ? parseChatResponsePayload(payload.response) : undefined }
        : null;
};

const isChatRequestEvent = (value: unknown): value is ChatRequestEvent => {
    if (!isRecord(value)) {
        return false;
    }

    const hasBaseFields = typeof value.requestId === 'string'
        && typeof value.userId === 'string'
        && typeof value.conversationId === 'string';
    if (!hasBaseFields) {
        return false;
    }

    if (value.type === 'queued' && value.status === 'queued') {
        return true;
    }
    if (value.type === 'started' && value.status === 'started') {
        return true;
    }
    if (value.type === 'completed' && value.status === 'completed') {
        return isRecord(value.response);
    }
    if (value.type === 'failed' && value.status === 'failed') {
        return typeof value.error === 'string';
    }

    return false;
};

const readConversationResponse = async (response: Response): Promise<ConversationResponse | null> => {
    const payload: unknown = await response.json().catch(() => null);
    if (typeof payload !== 'object' || payload === null || !('messages' in payload)) {
        return null;
    }
    const record = payload as Record<string, unknown>;
    if (typeof record.conversationId !== 'string' || record.conversationId.trim().length === 0) {
        return null;
    }
    return payload as ConversationResponse;
};

const readChatErrorMessage = async (response: Response): Promise<string> => {
    const payload: unknown = await response.json().catch(() => null);
    if (typeof payload !== 'object' || payload === null) {
        return 'I could not reach the chat service. Please try again.';
    }

    const record = payload as Record<string, unknown>;
    const retryAfterMs = typeof record.retryAfterMs === 'number' ? record.retryAfterMs : null;
    const retryText = retryAfterMs && retryAfterMs > 0
        ? ` Try again in ${Math.max(1, Math.ceil(retryAfterMs / 1000))} seconds.`
        : '';
    if (record.errorCode === 'CHAT_REQUEST_IN_PROGRESS') {
        return 'I am still generating the previous response. Please wait for it to finish.';
    }
    if (record.errorCode === 'CHAT_MESSAGE_TOO_LONG') {
        return typeof record.error === 'string' ? record.error : 'That message is too long. Please shorten it and try again.';
    }
    if (record.errorCode === 'CHAT_TOKEN_BUDGET_EXCEEDED') {
        return `The chat token budget has been reached for now.${retryText}`;
    }
    if (record.errorCode === 'CHAT_DAILY_LIMIT_EXCEEDED') {
        return `The daily chat limit has been reached.${retryText}`;
    }
    if (record.errorCode === 'CHAT_RATE_LIMITED') {
        return `Too many chat messages were sent too quickly.${retryText}`;
    }

    return typeof record.error === 'string' ? record.error : 'I could not reach the chat service. Please try again.';
};

// The reply text now carries the readable summary; jobs are rendered as styled cards separately.
const formatAssistantResponse = (data: ChatResponse): string =>
    data.reply ? data.reply : "I couldn't understand that.";

const extractJobCards = (data: ChatResponse): Message['jobs'] =>
    (data.jobs ?? []).slice(0, 5).map((job) => ({
        id: job.id,
        title: job.title,
        company: job.company,
        seniority: job.seniority,
        location: job.location,
    }));

const buildChatWebSocketUrl = (ticket: string): string => {
    const url = new URL(ENV.CHAT_SERVICE_BASE_URL || window.location.origin);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.pathname = '/chat/ws';
    url.search = '';
    url.searchParams.set('ticket', ticket);
    return url.toString();
};

const requestSocketTicket = async (): Promise<string | null> => {
    const response = await apiFetch(`${ENV.CHAT_SERVICE_BASE_URL}/chat/ws-ticket`, { method: 'POST' });
    if (!response.ok) {
        return null;
    }

    const payload: unknown = await response.json().catch(() => null);
    return isRecord(payload) && typeof payload.ticket === 'string' ? payload.ticket : null;
};

const sleep = async (ms: number): Promise<void> =>
    await new Promise((resolve) => {
        window.setTimeout(resolve, ms);
    });

const parseJsonOrNull = (value: string): unknown => {
    try {
        return JSON.parse(value) as unknown;
    } catch {
        return null;
    }
};

export const ChatInterface = ({ userId, conversationId, onExportSnapshotChange, userProfile }: ChatProps) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [loadingLabel, setLoadingLabel] = useState('Typing...');

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const websocketRef = useRef<WebSocket | null>(null);
    const socketConnectionPromiseRef = useRef<Promise<boolean> | null>(null);
    const pendingRequestsRef = useRef<Map<string, PendingRequestHandler>>(new Map());
    const fallbackPollingRequestIdsRef = useRef<Set<string>>(new Set());

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        onExportSnapshotChange?.({ conversationId, messages });
    }, [conversationId, messages, onExportSnapshotChange]);

    const resolvePendingRequest = useCallback((requestId: string, response: ChatResponse): void => {
        const pendingRequest = pendingRequestsRef.current.get(requestId);
        if (!pendingRequest) {
            return;
        }

        pendingRequestsRef.current.delete(requestId);
        fallbackPollingRequestIdsRef.current.delete(requestId);
        pendingRequest.resolve(response);
    }, []);

    const rejectPendingRequest = useCallback((requestId: string, error: Error): void => {
        const pendingRequest = pendingRequestsRef.current.get(requestId);
        if (!pendingRequest) {
            return;
        }

        pendingRequestsRef.current.delete(requestId);
        fallbackPollingRequestIdsRef.current.delete(requestId);
        pendingRequest.reject(error);
    }, []);

    const handleSocketMessage = useCallback((event: MessageEvent): void => {
        const payload = typeof event.data === 'string' ? parseJsonOrNull(event.data) : null;
        if (!isChatRequestEvent(payload) || payload.userId !== userId) {
            return;
        }

        if (payload.type === 'started') {
            setLoadingLabel('Typing...');
            return;
        }

        if (payload.type === 'completed') {
            resolvePendingRequest(payload.requestId, parseChatResponsePayload(payload.response));
            return;
        }

        if (payload.type === 'failed') {
            rejectPendingRequest(payload.requestId, new Error(payload.error));
        }
    }, [rejectPendingRequest, resolvePendingRequest, userId]);

    const pollChatRequest = useCallback(async (
        requestId: string,
        attemptsLeft = CHAT_REQUEST_POLL_ATTEMPTS
    ): Promise<ChatResponse> => {
        const response = await apiFetch(`${ENV.CHAT_SERVICE_BASE_URL}/chat/requests/${encodeURIComponent(requestId)}`);
        if (!response.ok) {
            throw new Error('Unable to read queued chat response.');
        }

        const requestState = await readChatRequestResponse(response);
        if (!requestState) {
            throw new Error('Unable to read queued chat response.');
        }

        if (requestState.status === 'completed' && requestState.response) {
            return requestState.response;
        }

        if (requestState.status === 'failed') {
            throw new Error(requestState.error ?? 'The queued chat response failed.');
        }

        if (attemptsLeft <= 0) {
            throw new Error('The queued chat response is taking longer than expected.');
        }

        await sleep(CHAT_REQUEST_POLL_INTERVAL_MS);
        return await pollChatRequest(requestId, attemptsLeft - 1);
    }, []);

    const startFallbackPolling = useCallback((requestId: string): void => {
        if (!pendingRequestsRef.current.has(requestId) || fallbackPollingRequestIdsRef.current.has(requestId)) {
            return;
        }

        fallbackPollingRequestIdsRef.current.add(requestId);
        void pollChatRequest(requestId)
            .then((response) => {
                resolvePendingRequest(requestId, response);
            })
            .catch((error: unknown) => {
                rejectPendingRequest(requestId, error instanceof Error ? error : new Error(String(error)));
            });
    }, [pollChatRequest, rejectPendingRequest, resolvePendingRequest]);

    const handleSocketClose = useCallback((socket: WebSocket): void => {
        if (websocketRef.current === socket) {
            websocketRef.current = null;
        }

        Array.from(pendingRequestsRef.current.keys()).forEach(startFallbackPolling);
    }, [startFallbackPolling]);

    const connectChatSocket = useCallback(async (): Promise<boolean> => {
        const existingSocket = websocketRef.current;
        if (existingSocket?.readyState === WebSocket.OPEN) {
            return true;
        }
        if (existingSocket?.readyState === WebSocket.CONNECTING) {
            return await (socketConnectionPromiseRef.current ?? Promise.resolve(false));
        }

        const connectionPromise = requestSocketTicket()
            .then(async (ticket) => {
                if (!ticket) {
                    return false;
                }

                return await new Promise<boolean>((resolve) => {
                    const socket = new WebSocket(buildChatWebSocketUrl(ticket));
                    websocketRef.current = socket;
                    socket.onmessage = handleSocketMessage;
                    socket.onopen = () => {
                        resolve(true);
                    };
                    socket.onerror = () => {
                        resolve(false);
                    };
                    socket.onclose = () => {
                        handleSocketClose(socket);
                        resolve(false);
                    };
                });
            })
            .catch(() => false)
            .finally(() => {
                socketConnectionPromiseRef.current = null;
            });

        socketConnectionPromiseRef.current = connectionPromise;
        return await connectionPromise;
    }, [handleSocketClose, handleSocketMessage]);

    const waitForQueuedResponse = async (requestId: string): Promise<ChatResponse> => {
        const socketOrPollResponse = new Promise<ChatResponse>((resolve, reject) => {
            pendingRequestsRef.current.set(requestId, { resolve, reject });
        });
        setLoadingLabel('Queued...');
        const socketConnected = await connectChatSocket();
        const socketIsOpen = socketConnected && websocketRef.current?.readyState === WebSocket.OPEN;

        if (!socketIsOpen) {
            startFallbackPolling(requestId);
        }

        const fallbackTimeoutId = window.setTimeout(() => {
            startFallbackPolling(requestId);
        }, CHAT_REQUEST_WEBSOCKET_TIMEOUT_MS);

        try {
            return await socketOrPollResponse;
        } finally {
            window.clearTimeout(fallbackTimeoutId);
        }
    };

    useEffect(() => {
        const pendingRequests = pendingRequestsRef.current;
        const fallbackPollingRequestIds = fallbackPollingRequestIdsRef.current;
        void connectChatSocket();

        return () => {
            websocketRef.current?.close();
            websocketRef.current = null;
            socketConnectionPromiseRef.current = null;
            pendingRequests.forEach((pendingRequest) => {
                pendingRequest.reject(new Error('Chat connection closed.'));
            });
            pendingRequests.clear();
            fallbackPollingRequestIds.clear();
        };
    }, [connectChatSocket, userId]);

    useEffect(() => {
        const loadConversation = async () => {
            setIsLoading(true);
            setMessages([]);
            setInput('');
            try {
                const query = new URLSearchParams({ conversationId });
                const response = await apiFetch(`${ENV.CHAT_SERVICE_BASE_URL}/chat/${userId}?${query.toString()}`);
                if (!response.ok) {
                    return;
                }
                const conversation = await readConversationResponse(response);
                if (!conversation) {
                    return;
                }
                setMessages(conversation.messages.map((message) => {
                    const jobsFromHistory = (message.attachedJobs ?? []).slice(0, 5).map((job) => ({
                        id: job.jobId ?? crypto.randomUUID(),
                        title: job.jobTitle,
                        company: job.company ?? '',
                        seniority: job.seniority ?? '',
                        location: null,
                    }));
                    return {
                        id: crypto.randomUUID(),
                        role: message.role,
                        content: message.content,
                        ...(jobsFromHistory.length > 0 ? { jobs: jobsFromHistory } : {}),
                    };
                }));
            } finally {
                setIsLoading(false);
            }
        };

        loadConversation().catch(() => undefined);
    }, [userId, conversationId]);

    const handleInput = (e: ChangeEvent<HTMLTextAreaElement>) => {
        setInput(e.target.value);
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleSend = async () => {
        const text = input.trim();
        if (!text.length) return;

        const userMessage = createMessage('user', text);
        setMessages(prev => [...prev, userMessage]);
        setInput('');

        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
        }

        setIsLoading(true);
        setLoadingLabel('Queued...');

        try {
            const response = await apiFetch(`${ENV.CHAT_SERVICE_BASE_URL}/chat/message`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId,
                    conversationId,
                    message: text,
                    userProfile,
                    accessToken: getStoredAccessToken() ?? undefined,
                })
            });
            if (!response.ok) {
                const errorMessage = await readChatErrorMessage(response);
                if (response.status === HTTP_TOO_MANY_REQUESTS) {
                    setInput(text);
                }
                setMessages(prev => [...prev, createMessage('assistant', errorMessage)]);
                return;
            }

            if (response.status === HTTP_ACCEPTED) {
                const queued = await readQueuedResponse(response);
                if (!queued) {
                    setMessages(prev => [...prev, createMessage('assistant', 'The chat request was queued, but I could not read its request id.')]);
                    return;
                }

                const data = await waitForQueuedResponse(queued.requestId);
                setMessages(prev => [...prev, createMessage('assistant', formatAssistantResponse(data), extractJobCards(data))]);
                return;
            }

            const data = await readChatResponse(response);
            setMessages(prev => [...prev, createMessage('assistant', formatAssistantResponse(data), extractJobCards(data))]);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Server connection error.';
            setMessages(prev => [...prev, createMessage('assistant', errorMessage || 'Server connection error.')]);
        } finally {
            setIsLoading(false);
            setLoadingLabel('Typing...');
        }
    };

    return (
        <div className="chat-container">
            <div className="messages-area">
                {messages.map((msg) => (
                    <div key={msg.id} className={`message-wrapper ${msg.role}`}>
                        <div className="message-bubble">{msg.content}</div>
                        {msg.jobs && msg.jobs.length > 0 && (
                            <div className="chat-job-cards">
                                {msg.jobs.map((job, index) => (
                                    <div key={job.id} className="chat-job-card">
                                        <span className="chat-job-card__index">{index + 1}</span>
                                        <div className="chat-job-card__body">
                                            <div className="chat-job-card__title">{job.title}</div>
                                            <div className="chat-job-card__company">{job.company}</div>
                                            <div className="chat-job-card__meta">
                                                {job.seniority && <span className="chat-job-card__chip">{job.seniority}</span>}
                                                {job.location && <span className="chat-job-card__loc">{job.location}</span>}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
                {isLoading && <div className="message-wrapper assistant"><div className="message-bubble">{loadingLabel}</div></div>}
                <div ref={messagesEndRef} />
            </div>

            <div className="input-area">
                <textarea
                    ref={textareaRef}
                    placeholder="Type a message..."
                    value={input}
                    onChange={handleInput}
                    onKeyDown={handleKeyDown}
                    rows={1}
                />
                <button type="button" onClick={handleSend} disabled={isLoading || !input.trim()}>➤</button>
            </div>
        </div>
    );
};
