import { useState, useEffect, useRef, type ChangeEvent, type KeyboardEvent } from 'react';
import './Chat.css';
import { ENV } from '../../config';
import { apiFetch } from '../../lib/apiClient';
import type { ChatProps, ChatResponse, Message } from './chat.types';

const createMessage = (role: Message['role'], content: string): Message => ({
    id: crypto.randomUUID(),
    role,
    content,
});

const readChatResponse = async (response: Response): Promise<ChatResponse> => {
    const payload: unknown = await response.json().catch(() => ({}));
    if (typeof payload !== 'object' || payload === null || !('response' in payload)) {
        return {};
    }

    return typeof payload.response === 'string' ? { response: payload.response } : {};
};

export const ChatInterface = ({ userId, userName }: ChatProps) => {
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

    // פונקציה להגדלת התיבה
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
        if (!input.trim()) return;

        const userMessage = createMessage('user', input);
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        
        // איפוס גובה התיבה
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
        }
        
        setIsLoading(true);

        try {
            const response = await apiFetch(`${ENV.CHAT_SERVICE_BASE_URL}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, message: input })
            });

            const data = await readChatResponse(response);
            const modelResponse = data.response;
            if (modelResponse) {
                setMessages(prev => [...prev, createMessage('model', modelResponse)]);
            } else {
                setMessages(prev => [...prev, createMessage('model', "I couldn't understand that.")]);
            }
        } catch {
            setMessages(prev => [...prev, createMessage('model', "Server connection error.")]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="chat-container">
            <div className="messages-area">
                <div className="message-wrapper model">
                    <div className="message-bubble">
                        Hi {userName || 'there'}! 👋 I'm CareerCoach AI.
                    </div>
                </div>
                {messages.map((msg) => (
                    <div key={msg.id} className={`message-wrapper ${msg.role}`}>
                        <div className="message-bubble">{msg.content}</div>
                    </div>
                ))}
                {isLoading && <div className="message-wrapper model"><div className="message-bubble">Typing...</div></div>}
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