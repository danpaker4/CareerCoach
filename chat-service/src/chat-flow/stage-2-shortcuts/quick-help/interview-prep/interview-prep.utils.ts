import type {
    InterviewDifficulty,
    InterviewFocusOption,
    InterviewFocusSelectionLlmResult,
    InterviewGradeLlmResult,
    InterviewGradeOutcome,
    InterviewProgressUpdate,
    InterviewQuestionResult,
    InterviewTeachingLlmResult,
    InterviewTeachingStatus,
    InterviewTopicPlanLlmResult,
} from "./interview-prep.types";
import type { RoleExperienceEntry } from "../../../../routes/external-chat-tools/role-experience.types";
import {
    QUICK_HELP_INTERVIEW_FEEDBACK_MAX_CHARS,
    QUICK_HELP_INTERVIEW_HARD_SCORE_MIN,
    QUICK_HELP_INTERVIEW_MEDIUM_SCORE_MIN,
    QUICK_HELP_INTERVIEW_MODEL_ANSWER_MAX_CHARS,
    QUICK_HELP_INTERVIEW_QUESTION_MAX_CHARS,
    QUICK_HELP_INTERVIEW_SCORE_BANDS,
    QUICK_HELP_INTERVIEW_TIP_MAX_CHARS,
} from "./interview-prep.consts";

const isInterviewGradeOutcome = (value: unknown): value is InterviewGradeOutcome =>
    value === "correct" ||
    value === "partially_correct" ||
    value === "incorrect" ||
    value === "needs_teaching";

const isInterviewTeachingStatus = (value: unknown): value is InterviewTeachingStatus =>
    value === "understood" || value === "needs_reteaching" || value === "asks_question";

const isSuitableInterviewOption = (value: string): boolean =>
    !/\b(write|implement|create)\s+(code|a function|an algorithm|pseudocode)\b|\b(draw|diagram|whiteboard)\b/i.test(value);

export const compactInterviewText = (value: string, maxChars: number, maxSentences: number): string => {
    const sentences = value.trim().match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [value.trim()];
    const sentenceLimited = sentences.slice(0, maxSentences).join(" ").trim();
    return sentenceLimited.length <= maxChars
        ? sentenceLimited
        : `${sentenceLimited.slice(0, maxChars - 1).trimEnd()}…`;
};

export const isAllowedSpokenInterviewQuestion = (question: string): boolean =>
    !/\b(write|implement|code|coding exercise|pseudocode|draw|diagram|whiteboard)\b/i.test(question);

export const isInterviewFeedbackChallenge = (message: string): boolean =>
    /\b(that'?s|that is)\s+(what|basically what)\s+i\s+(said|meant)\b/i.test(message) ||
    /\b(i\s+was\s+right|why\s+(am|was)\s+i\s+wrong|are\s+you\s+sure|reconsider)\b/i.test(message) ||
    /\bi\s+(already\s+)?said\s+that\b/i.test(message);

export const isLegacyInterviewAcknowledgement = (message: string): boolean =>
    /^(got it|i understand|makes sense|okay|ok|clear|thanks)[.!]?$/i.test(message.trim());

export const isExplicitInterviewKnowledgeGap = (message: string): boolean =>
    /^(?:i\s+)?(?:don'?t|do not)\s+know(?:\s+(?:that|this|it|the answer|what (?:that|this|it) is))?[.!]?$/i.test(
        message.trim()
    ) || /^(?:i\s+have\s+)?no idea[.!]?$/i.test(message.trim()) || /^idk[.!]?$/i.test(message.trim());

export const extractInterviewTopicCorrection = (message: string): string | undefined => {
    const correction = message.match(/\bi\s+(?:said|asked\s+for)\s+(.+?)(?:[,.;]?\s+(?:not|instead\s+of)\b|$)/i)?.[1]
        ?? message.match(/\bi\s+want(?:ed)?\s+(.+?)\s+(?:not|instead\s+of)\b/i)?.[1];
    const trimmedCorrection = correction?.trim();
    return trimmedCorrection && trimmedCorrection.length > 0 ? trimmedCorrection : undefined;
};

const INTERVIEW_TOPIC_STOP_WORDS = new Set([
    "a", "an", "about", "for", "help", "i", "interview", "interviews", "me", "prepare", "preparing", "should",
    "study", "the", "to", "what", "with",
]);

const normalizeInterviewWords = (value: string): string[] =>
    value.toLowerCase().replace(/[^a-z0-9+#.]+/g, " ").trim().split(/\s+/).filter(Boolean);

const getInterviewTopicKeywords = (topic: string): string[] =>
    normalizeInterviewWords(topic).filter((word) => !INTERVIEW_TOPIC_STOP_WORDS.has(word));

export const parseInterviewDifficulty = (message: string): InterviewDifficulty | undefined => {
    if (/\b(easy|beginner)\b/i.test(message)) return "easy";
    if (/\b(medium|intermediate)\b/i.test(message)) return "medium";
    if (/\b(hard|advanced|expert)\b/i.test(message)) return "hard";
    return undefined;
};

export const mapInterviewYearsToDifficulty = (years: number): InterviewDifficulty => {
    if (years < 2) return "easy";
    if (years > 10) return "hard";
    return "medium";
};

export const normalizeInterviewScore = (outcome: InterviewGradeOutcome, score: unknown): number => {
    const band = QUICK_HELP_INTERVIEW_SCORE_BANDS[outcome];
    if (typeof score !== "number" || !Number.isFinite(score) || score < band.min || score > band.max) {
        return band.fallback;
    }
    return score;
};

export const calculateInterviewAverage = (scores: readonly number[]): number => {
    if (scores.length === 0) return 0;
    return scores.reduce((total, score) => total + score, 0) / scores.length;
};

export const difficultyForInterviewAverage = (average: number): InterviewDifficulty => {
    if (average < QUICK_HELP_INTERVIEW_MEDIUM_SCORE_MIN) return "easy";
    if (average < QUICK_HELP_INTERVIEW_HARD_SCORE_MIN) return "medium";
    return "hard";
};

export const updateInterviewAttemptScores = (
    currentAttemptScores: readonly number[],
    score: number,
    mode: "append" | "replace"
): number[] => {
    if (mode === "replace" && currentAttemptScores.length > 0) {
        return [...currentAttemptScores.slice(0, -1), score];
    }
    return [...currentAttemptScores, score];
};

export const completeInterviewQuestion = (params: {
    question: string | undefined;
    difficulty: InterviewDifficulty;
    attemptScores: readonly number[];
    questionResults: readonly InterviewQuestionResult[];
}): InterviewProgressUpdate => {
    if (!params.question || params.attemptScores.length === 0) {
        return { questionResults: [...params.questionResults], nextDifficulty: params.difficulty };
    }

    const result: InterviewQuestionResult = {
        question: params.question,
        difficulty: params.difficulty,
        attemptScores: [...params.attemptScores],
        score: calculateInterviewAverage(params.attemptScores),
    };
    const questionResults = [...params.questionResults, result];
    const sessionAverage = calculateInterviewAverage(questionResults.map((questionResult) => questionResult.score));
    return { questionResults, nextDifficulty: difficultyForInterviewAverage(sessionAverage) };
};

export const getFallbackInterviewQuestions = (topic: string, difficulty: InterviewDifficulty): string[] => {
    if (difficulty === "easy") {
        return [
            `What is ${topic}, in simple terms?`,
            `Why is ${topic} useful?`,
            `What is one common concept in ${topic}?`,
            `When would you use ${topic}?`,
            `What is one common mistake related to ${topic}?`,
        ];
    }
    if (difficulty === "hard") {
        return [
            `What are the most important tradeoffs in a complex use of ${topic}?`,
            `How would you evaluate competing approaches within ${topic}?`,
            `What subtle failure modes should an expert consider in ${topic}?`,
            `How do constraints change the best approach to ${topic}?`,
            `What advanced misconception about ${topic} causes poor decisions?`,
        ];
    }
    return [
        `When would you choose ${topic} over a common alternative, and why?`,
        `What are two important tradeoffs or limitations related to ${topic}?`,
        `How do the core concepts in ${topic} relate to each other?`,
        `How would you explain a practical decision involving ${topic}?`,
        `What misconception do people often have about ${topic}?`,
    ];
};

export const parseInterviewExperienceYears = (message: string): number | undefined => {
    const qualifiedMatch = message.match(
        /\b(?:(less\s+than|under|more\s+than|over)\s+)?(\d{1,2}(?:\.\d+)?)\s*(\+)?\s*(?:years?|yrs?)\b/i
    );
    const plainMatch = message.trim().match(/^(\d{1,2}(?:\.\d+)?)$/);
    const rawYears = qualifiedMatch?.[2] ?? plainMatch?.[1];
    if (!rawYears) return undefined;
    const years = Number.parseFloat(rawYears);
    if (!Number.isFinite(years) || years < 0 || years > 60) return undefined;
    const qualifier = qualifiedMatch?.[1]?.toLowerCase();
    if (qualifier === "less than" || qualifier === "under") return Math.max(0, years - 0.01);
    if (qualifier === "more than" || qualifier === "over" || qualifiedMatch?.[3] === "+") return years + 0.01;
    return years;
};

export const resolveInterviewDifficulty = (
    topic: string,
    roleExperience: readonly RoleExperienceEntry[]
): InterviewDifficulty | undefined => {
    const explicitDifficulty = parseInterviewDifficulty(topic);
    if (explicitDifficulty) return explicitDifficulty;

    const topicKeywords = getInterviewTopicKeywords(topic);
    if (topicKeywords.length === 0) return undefined;
    const relevantRole = roleExperience.find((role) => {
        const roleWords = new Set(normalizeInterviewWords(role.displayLabel));
        return topicKeywords.every((keyword) => roleWords.has(keyword));
    });
    return relevantRole ? mapInterviewYearsToDifficulty(relevantRole.years) : undefined;
};

export const parseInterviewTopicPlan = (parsed: Record<string, unknown> | null): InterviewTopicPlanLlmResult => {
    if (parsed?.action === "start_practice") {
        return { action: "start_practice" };
    }
    if (parsed?.action !== "offer_options" || !Array.isArray(parsed.options) || parsed.options.length !== 2) {
        return { action: "invalid" };
    }

    const parsedOptions = parsed.options.map((rawOption, index): InterviewFocusOption | null => {
        if (typeof rawOption !== "object" || rawOption === null || Array.isArray(rawOption)) {
            return null;
        }
        const option = rawOption as Record<string, unknown>;
        if (typeof option.title !== "string" || typeof option.description !== "string") {
            return null;
        }
        const title = compactInterviewText(option.title, 90, 1);
        const description = compactInterviewText(option.description, 240, 1);
        if (!title || !description || !isSuitableInterviewOption(`${title} ${description}`)) {
            return null;
        }
        return { id: `option-${index + 1}`, title, description };
    });
    const first = parsedOptions[0];
    const second = parsedOptions[1];
    if (!first || !second || first.title.toLowerCase() === second.title.toLowerCase()) {
        return { action: "invalid" };
    }
    const introduction = "Here are two focused areas within the topic you chose.";
    return { action: "offer_options", introduction, options: [first, second] };
};

export const parseInterviewFocusSelection = (
    parsed: Record<string, unknown> | null,
    options: readonly InterviewFocusOption[]
): InterviewFocusSelectionLlmResult => {
    if (parsed?.kind === "both") {
        return { kind: "both" };
    }
    if (parsed?.kind === "declined") {
        return { kind: "declined" };
    }
    if (parsed?.kind !== "selected" || typeof parsed.selectedOptionId !== "string") {
        return { kind: "ambiguous" };
    }
    return options.some((option) => option.id === parsed.selectedOptionId)
        ? { kind: "selected", selectedOptionId: parsed.selectedOptionId }
        : { kind: "ambiguous" };
};

export const parseInterviewGradeResult = (parsed: Record<string, unknown> | null): InterviewGradeLlmResult => {
    const outcome = isInterviewGradeOutcome(parsed?.outcome)
        ? parsed.outcome
        : parsed?.correct === true
          ? "correct"
          : "incorrect";
    const feedback = typeof parsed?.feedback === "string" && parsed.feedback.trim().length > 0
        ? compactInterviewText(parsed.feedback, QUICK_HELP_INTERVIEW_FEEDBACK_MAX_CHARS, 3)
        : "That answer needs a clearer explanation of the core idea.";
    const followUpQuestions = Array.isArray(parsed?.followUpQuestions)
        ? parsed.followUpQuestions
              .filter(
                  (question): question is string =>
                      typeof question === "string" &&
                      question.trim().length > 0 &&
                      isAllowedSpokenInterviewQuestion(question)
              )
              .map((question) => compactInterviewText(question, QUICK_HELP_INTERVIEW_QUESTION_MAX_CHARS, 1))
              .slice(0, 3)
        : [];
    const modelAnswer = typeof parsed?.modelAnswer === "string" && parsed.modelAnswer.trim().length > 0
        ? compactInterviewText(parsed.modelAnswer, QUICK_HELP_INTERVIEW_MODEL_ANSWER_MAX_CHARS, 3)
        : "A strong answer states the core concept and directly addresses every part of the question.";
    const improvementTip = typeof parsed?.improvementTip === "string" && parsed.improvementTip.trim().length > 0
        ? compactInterviewText(parsed.improvementTip, QUICK_HELP_INTERVIEW_TIP_MAX_CHARS, 1)
        : "Answer each part of the question explicitly.";
    const teachingExplanation = typeof parsed?.teachingExplanation === "string" && parsed.teachingExplanation.trim().length > 0
        ? compactInterviewText(parsed.teachingExplanation, QUICK_HELP_INTERVIEW_FEEDBACK_MAX_CHARS, 3)
        : "Let's break the core idea into a simpler definition before you answer it as an interview question.";
    const teachingExample = typeof parsed?.teachingExample === "string" && parsed.teachingExample.trim().length > 0
        ? compactInterviewText(parsed.teachingExample, QUICK_HELP_INTERVIEW_MODEL_ANSWER_MAX_CHARS, 2)
        : "Think of a small real-world situation where this concept appears.";
    const understandingCheck = typeof parsed?.understandingCheck === "string" && parsed.understandingCheck.trim().length > 0
        ? compactInterviewText(parsed.understandingCheck, QUICK_HELP_INTERVIEW_QUESTION_MAX_CHARS, 1)
        : "How would you describe the core idea in your own words?";
    const score = normalizeInterviewScore(outcome, parsed?.score);

    return {
        outcome,
        score,
        feedback,
        followUpQuestions,
        modelAnswer,
        improvementTip,
        teachingExplanation,
        teachingExample,
        understandingCheck,
    };
};

export const parseInterviewTeachingResult = (
    parsed: Record<string, unknown> | null
): InterviewTeachingLlmResult => {
    const status = isInterviewTeachingStatus(parsed?.status) ? parsed.status : "needs_reteaching";
    const response = typeof parsed?.response === "string" && parsed.response.trim().length > 0
        ? compactInterviewText(parsed.response, QUICK_HELP_INTERVIEW_FEEDBACK_MAX_CHARS, 3)
        : "Let's look at the idea another way.";
    const explanation = typeof parsed?.explanation === "string" && parsed.explanation.trim().length > 0
        ? compactInterviewText(parsed.explanation, QUICK_HELP_INTERVIEW_FEEDBACK_MAX_CHARS, 3)
        : "Focus on the simplest definition and what changes in a real situation.";
    const example = typeof parsed?.example === "string" && parsed.example.trim().length > 0
        ? compactInterviewText(parsed.example, QUICK_HELP_INTERVIEW_MODEL_ANSWER_MAX_CHARS, 2)
        : "Try connecting the definition to one concrete everyday example.";
    const understandingCheck = typeof parsed?.understandingCheck === "string" && parsed.understandingCheck.trim().length > 0
        ? compactInterviewText(parsed.understandingCheck, QUICK_HELP_INTERVIEW_QUESTION_MAX_CHARS, 1)
        : "How would you describe the core idea in your own words?";

    return { status, response, explanation, example, understandingCheck };
};
