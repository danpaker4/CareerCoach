import { useState, useEffect } from 'react';
import './AiAnalysisLoader.css';

const ANALYSIS_STEPS = [
    { label: 'Scanning available positions', duration: 800 },
    { label: 'Loading your career profile', duration: 1000 },
    { label: 'Running AI match analysis', duration: 1500 },
    { label: 'Ranking by relevance', duration: 700 },
];

export const AiAnalysisLoader = () => {
    const [completedSteps, setCompletedSteps] = useState(0);

    useEffect(() => {
        if (completedSteps >= ANALYSIS_STEPS.length) return;

        const timer = setTimeout(() => {
            setCompletedSteps((prev) => prev + 1);
        }, ANALYSIS_STEPS[completedSteps].duration);

        return () => clearTimeout(timer);
    }, [completedSteps]);

    return (
        <div className="ai-loader">
            <div className="ai-loader-header">
                <div className="ai-loader-icon">
                    <div className="ai-pulse-ring" />
                    <span className="ai-brain-icon">&#129504;</span>
                </div>
                <div>
                    <h3 className="ai-loader-title">AI Analysis in Progress</h3>
                    <p className="ai-loader-subtitle">
                        Matching jobs to your unique profile
                    </p>
                </div>
            </div>

            <div className="ai-steps">
                {ANALYSIS_STEPS.map((step, idx) => {
                    const isDone = idx < completedSteps;
                    const isActive = idx === completedSteps;

                    return (
                        <div
                            key={step.label}
                            className={`ai-step ${isDone ? 'ai-step--done' : ''} ${isActive ? 'ai-step--active' : ''}`}
                        >
                            <span className="ai-step-indicator">
                                {isDone ? '✓' : ''}
                            </span>
                            <span className="ai-step-label">{step.label}</span>
                            {isActive && (
                                <span className="ai-step-dots">
                                    <span className="dot" />
                                    <span className="dot" />
                                    <span className="dot" />
                                </span>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
