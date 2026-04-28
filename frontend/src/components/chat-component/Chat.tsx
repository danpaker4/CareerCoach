import { useState, useEffect, useRef, type ChangeEvent, type KeyboardEvent } from 'react';
import './Chat.css';
import { ENV } from '../../config';
import type { ChatProps, ChatResponse, ConversationResponse, Message } from './chat.types';

const createMessage = (role: Message['role'], content: string): Message => ({
    id: crypto.randomUUID(),
    role,
    content,
});

const readChatResponse = async (response: Response): Promise<ChatResponse> => {
    const payload: unknown = await response.json().catch(() => ({}));
    if (typeof payload !== 'object' || payload === null || !('reply' in payload)) {
        return {};
    }

    return typeof payload.reply === 'string' ? { reply: payload.reply } : {};
};

const readConversationResponse = async (response: Response): Promise<ConversationResponse | null> => {
    const payload: unknown = await response.json().catch(() => null);
    if (typeof payload !== 'object' || payload === null || !('messages' in payload)) {
        return null;
    }
    return payload as ConversationResponse;
};

export const ChatInterface = ({ userId, userProfile }: ChatProps) => {
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
            try {
                const response = await fetch(`${ENV.CHAT_SERVICE_BASE_URL}/chat/${userId}`);
                if (!response.ok) {
                    return;
                }
                const conversation = await readConversationResponse(response);
                if (!conversation) {
                    return;
                }
                setMessages(conversation.messages.map((message) => ({
                    id: crypto.randomUUID(),
                    role: message.role,
                    content: message.content,
                })));
            } finally {
                setIsLoading(false);
            }
        };

        loadConversation().catch(() => undefined);
    }, [userId]);

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
            const response = await fetch(`${ENV.CHAT_SERVICE_BASE_URL}/chat/message`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, message: input, userProfile })
            });

            const data = await readChatResponse(response);
            const assistantReply = data.reply;
            if (assistantReply) {
                setMessages(prev => [...prev, createMessage('assistant', assistantReply)]);
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