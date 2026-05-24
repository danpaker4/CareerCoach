import { useState, useEffect, useCallback } from 'react';
import './AiAnalysisLoader.css';

interface AiAnalysisLoaderProps {
    isDataReady: boolean;
    onComplete: () => void;
}

const ANALYSIS_STEPS = [
    { label: 'Scanning available positions', minDurationMs: 600 },
    { label: 'Loading your career profile', minDurationMs: 800 },
    { label: 'Running AI match analysis', minDurationMs: 0 },
    { label: 'Ranking by relevance', minDurationMs: 400 },
] as const;

const COMPLETION_DELAY_MS = 300;
const FAST_FORWARD_MS = 200;

export const AiAnalysisLoader = ({ isDataReady, onComplete }: AiAnalysisLoaderProps) => {
    const [activeStep, setActiveStep] = useState(0);

    const advanceStep = useCallback(() => {
        setActiveStep((prev) => prev + 1);
    }, []);

    // Auto-advance steps 0 and 1 on their min durations
    useEffect(() => {
        const step = ANALYSIS_STEPS[activeStep];
        if (!step || activeStep > 1) return;

        const timer = setTimeout(advanceStep, step.minDurationMs);
        return () => clearTimeout(timer);
    }, [activeStep, advanceStep]);

    // Step 2 waits for actual data, then advances
    useEffect(() => {
        if (activeStep !== 2 || !isDataReady) return;

        const timer = setTimeout(advanceStep, FAST_FORWARD_MS);
        return () => clearTimeout(timer);
    }, [activeStep, isDataReady, advanceStep]);

    // Step 3 completes then fires onComplete
    useEffect(() => {
        if (activeStep !== 3) return;

        const timer = setTimeout(() => {
            setActiveStep(ANALYSIS_STEPS.length);
            setTimeout(onComplete, COMPLETION_DELAY_MS);
        }, ANALYSIS_STEPS[3].minDurationMs);

        return () => clearTimeout(timer);
    }, [activeStep, onComplete]);

    return (
        <div className="ai-loader">
            <div className="ai-loader-header">
                <div className="ai-loader-icon">
                    <div className="ai-pulse-ring" />
                    <span className="ai-brain-icon" role="img" aria-label="brain">&#129504;</span>
                </div>
                <div>
                    <h3 className="ai-loader-title">AI Analysis in Progress</h3>
                    <p className="ai-loader-subtitle">Matching jobs to your unique profile</p>
                </div>
            </div>

            <div className="ai-steps">
                {ANALYSIS_STEPS.map((step, idx) => {
                    const isDone = idx < activeStep;
                    const isActive = idx === activeStep;

                    return (
                        <div
                            key={step.label}
                            className={`ai-step${isDone ? ' ai-step--done' : ''}${isActive ? ' ai-step--active' : ''}`}
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
