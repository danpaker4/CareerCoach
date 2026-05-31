import { useState, useEffect, useRef, type ChangeEvent, type KeyboardEvent } from 'react';
import './Chat.css';
import { ENV } from '../../config';
import { apiFetch } from '../../lib/apiClient';
import type { ChatProps, ChatResponse, ConversationResponse, Message } from './chat.types';

const HTTP_TOO_MANY_REQUESTS = 429;

const createMessage = (role: Message['role'], content: string): Message => ({
    id: crypto.randomUUID(),
    role,
    content,
});

const readChatResponse = async (response: Response): Promise<ChatResponse> => {
    const payload: unknown = await response.json().catch(() => ({}));
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

export const ChatInterface = ({ userId, conversationId, userProfile }: ChatProps) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

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
                    const jobsFromHistory = message.attachedJobs ?? [];
                    const historyJobsSummary = jobsFromHistory.length > 0
                        ? `\n\nReal jobs found:\n${jobsFromHistory.slice(0, 5).map((job) => {
                            const company = job.company && job.company.trim().length > 0 ? ` at ${job.company.trim()}` : '';
                            return `- ${job.jobTitle}${company} (${job.seniority})`;
                        }).join('\n')}`
                        : '';
                    return {
                        id: crypto.randomUUID(),
                        role: message.role,
                        content: `${message.content}${historyJobsSummary}`,
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

        try {
            const response = await apiFetch(`${ENV.CHAT_SERVICE_BASE_URL}/chat/message`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, conversationId, message: text, userProfile })
            });
            if (!response.ok) {
                const errorMessage = await readChatErrorMessage(response);
                if (response.status === HTTP_TOO_MANY_REQUESTS) {
                    setInput(text);
                }
                setMessages(prev => [...prev, createMessage('assistant', errorMessage)]);
                return;
            }

            const data = await readChatResponse(response);
            const assistantReply = data.reply;
            const jobsFromResponse = data.jobs ?? [];
            const jobsSummary = jobsFromResponse.length > 0
                ? `\n\nReal jobs found:\n${jobsFromResponse.slice(0, 5).map((job) => {
                    const company = job.company && job.company.trim().length > 0 ? ` at ${job.company.trim()}` : '';
                    return `- ${job.title}${company} (${job.seniority})`;
                }).join('\n')}`
                : (data.jobMatches && data.jobMatches.length > 0
                    ? `\n\nTop matches:\n${data.jobMatches.slice(0, 5).map((match) => `- ${match.title}`).join('\n')}`
                    : '');
            if (assistantReply) {
                setMessages(prev => [...prev, createMessage('assistant', `${assistantReply}${jobsSummary}`)]);
            } else {
                setMessages(prev => [...prev, createMessage('assistant', "I couldn't understand that.")]);
            }
        } catch {
            setMessages(prev => [...prev, createMessage('assistant', "Server connection error.")]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="chat-container">
            <div className="messages-area">
                {messages.map((msg) => (
                    <div key={msg.id} className={`message-wrapper ${msg.role}`}>
                        <div className="message-bubble">{msg.content}</div>
                    </div>
                ))}
                {isLoading && <div className="message-wrapper assistant"><div className="message-bubble">Typing...</div></div>}
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
