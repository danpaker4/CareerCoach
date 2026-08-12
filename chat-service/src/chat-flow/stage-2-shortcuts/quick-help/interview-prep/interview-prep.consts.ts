import type { InterviewGradeOutcome } from "./interview-prep.types";

export const QUICK_HELP_INTERVIEW_QUESTION_COUNT = 5;
export const QUICK_HELP_INTERVIEW_MAX_FOLLOW_UPS = 3;
export const QUICK_HELP_INTERVIEW_MAX_TEACHING_ATTEMPTS = 2;
export const QUICK_HELP_INTERVIEW_FEEDBACK_MAX_CHARS = 420;
export const QUICK_HELP_INTERVIEW_MODEL_ANSWER_MAX_CHARS = 320;
export const QUICK_HELP_INTERVIEW_TIP_MAX_CHARS = 180;
export const QUICK_HELP_INTERVIEW_QUESTION_MAX_CHARS = 240;
export const QUICK_HELP_INTERVIEW_PLAN_ATTEMPTS = 2;
export const QUICK_HELP_INTERVIEW_SCORE_BANDS: Record<
    InterviewGradeOutcome,
    { min: number; max: number; fallback: number }
> = {
    correct: { min: 80, max: 100, fallback: 90 },
    partially_correct: { min: 50, max: 79, fallback: 65 },
    incorrect: { min: 1, max: 49, fallback: 25 },
    needs_teaching: { min: 0, max: 0, fallback: 0 },
};
export const QUICK_HELP_INTERVIEW_MEDIUM_SCORE_MIN = 50;
export const QUICK_HELP_INTERVIEW_HARD_SCORE_MIN = 80;

export const QUICK_HELP_INTERVIEW_ASK_TOPIC =
    "Absolutely — what role or subject are you preparing for? For example: React, system design, or behavioral questions for a PM role.";

export const QUICK_HELP_INTERVIEW_ASK_EXPERIENCE = (topic: string): string =>
    `How many years of experience do you have with ${topic}?`;
