import { useState } from 'react';
import './Chat.css';

interface Message {
    role: 'user' | 'model';
    text: string;
}

interface ChatProps {
    userId: string;
    userName?: string; 
}

export function ChatInterface({ userId, userName }: ChatProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const sendMessage = async () => {
        if (!input.trim()) return;

        const userMessage = input;
        setInput('');
        setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
        setIsLoading(true);

        try {
            const response = await fetch('http://localhost:3000/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    userId: userId, 
                    message: userMessage 
                })
            });

            if (!response.ok) throw new Error("Server error");
            const data = await response.json();
            setMessages(prev => [...prev, { role: 'model', text: data.response }]);
        } catch (error) {
            console.error(error);
            setMessages(prev => [...prev, { role: 'model', text: "⚠️ Error connecting to AI." }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="chat-widget">
            {!isOpen && (
                <button className="chat-toggle-btn" onClick={() => setIsOpen(true)}>💬</button>
            )}
            {isOpen && (
                <div className="chat-window">
                    <div className="chat-header">
                        <div className="header-title">CareerMate AI</div>
                        <button className="close-btn" onClick={() => setIsOpen(false)}>×</button>
                    </div>
                    <div className="chat-messages">
                        {messages.map((msg, idx) => (
                            <div key={idx} className={`message ${msg.role}`}>{msg.text}</div>
                        ))}
                        {isLoading && <div className="message model">Thinking...</div>}
                    </div>
                    <div className="chat-input-area">
                        <input value={input} onChange={e => setInput(e.target.value)} />
                        <button onClick={sendMessage}>Send</button>
                    </div>
                </div>
            )}
        </div>
    );
}