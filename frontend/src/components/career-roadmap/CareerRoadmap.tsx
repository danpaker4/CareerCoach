import { useState } from 'react';
import Header from '../header/Header';
import { ChatInterface } from '../chat-component/Chat'; 
import './CareerRoadmap.css';

interface UserProps {
    user?: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
    };
}

export default function CareerRoadmap({ user }: UserProps) {
    const [isChatOpen, setIsChatOpen] = useState(false);

    return (
        <div className="roadmap-page">
            
            <main className="roadmap-container">

                <div className="roadmap-header">
                    <div>
                        <h1>Career Roadmap</h1>
                        <p className="subtitle">Define your career goals and track your growth plan</p>
                    </div>
                    <div className="header-actions">
                        <button 
                            className="btn-ai-guide"
                            onClick={() => setIsChatOpen(!isChatOpen)}
                        >
                            <span className="icon">💬</span> AI Career Guide
                        </button>
                        <button className="btn-add-goal">
                            <span className="icon">+</span> Add Goal
                        </button>
                    </div>
                </div>

                <div className="stats-row">
                    <div className="stat-card">
                        <div className="stat-icon blue">📈</div>
                        <div className="stat-info">
                            <span className="stat-label">Active Roadmaps</span>
                            <span className="stat-value">1</span>
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon green">🎖️</div>
                        <div className="stat-info">
                            <span className="stat-label">Completed</span>
                            <span className="stat-value">0</span>
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon purple">📅</div>
                        <div className="stat-info">
                            <span className="stat-label">Total Roadmaps</span>
                            <span className="stat-value">1</span>
                        </div>
                    </div>
                </div>

                {/* כרטיס המסלול הראשי */}
                <div className="main-roadmap-card">
                    <div className="card-top-info">
                        <h3>Mid-Level Software Engineer <span className="arrow">→</span> Senior Software Engineer</h3>
                        <p className="meta-info">Target: 31.12.2026 • 2 years timeline • 1 of 4 steps completed</p>
                    </div>

                    <div className="progress-section">
                        <div className="progress-label">
                            <span>Overall Progress</span>
                            <span>25%</span>
                        </div>
                        <div className="progress-bar-bg">
                            <div className="progress-bar-fill" style={{ width: '25%' }}></div>
                        </div>
                    </div>

                    {/* השלב הנוכחי */}
                    <div className="current-step-box">
                        <div className="step-check-icon">✓</div>
                        <div className="step-content">
                            <div className="step-header">
                                <span className="step-time">Months 1-6</span>
                                <span className="step-badge completed">Completed</span>
                            </div>
                            <h4>Mid-Level Software Engineer (Current)</h4>
                            <p className="step-description">Key Actions:</p>
                            <ul className="step-list">
                                <li>Master advanced algorithms and data structures</li>
                                <li>Take on more complex features and projects</li>
                            </ul>
                        </div>
                    </div>
                </div>

            </main>

            {/* החלון הצף של הצ'אט */}
            {isChatOpen && (
                <div className="floating-chat-wrapper">
                    <div className="chat-header-bar">
                        <span>CareerCoach AI</span>
                        <button className="close-chat" onClick={() => setIsChatOpen(false)}>✕</button>
                    </div>

                    <ChatInterface 
                        userId={user?.id || "guest"} 
                        userName={user?.firstName} 
                    />
                </div>
            )}
        </div>
    );
}