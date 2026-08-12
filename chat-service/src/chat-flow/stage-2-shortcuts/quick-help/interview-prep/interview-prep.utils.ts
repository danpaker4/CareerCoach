import type {
    InterviewFocusOption,
    InterviewFocusSelectionLlmResult,
    InterviewGradeLlmResult,
    InterviewGradeOutcome,
    InterviewTeachingLlmResult,
    InterviewTeachingStatus,
    InterviewTopicPlanLlmResult,
} from "./interview-prep.types";
import type { UserCareerProfile } from "../../../../routes/career-profile/career-profile.types";
import type { RoleExperienceEntry } from "../../../../routes/external-chat-tools/role-experience.types";
import {
    QUICK_HELP_INTERVIEW_FEEDBACK_MAX_CHARS,
    QUICK_HELP_INTERVIEW_MODEL_ANSWER_MAX_CHARS,
    QUICK_HELP_INTERVIEW_QUESTION_MAX_CHARS,
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

export const buildInterviewProfileContext = (
    profile: UserCareerProfile,
    roleExperience: readonly RoleExperienceEntry[]
): string => {
    const technologies = profile.technologies.map((signal) => signal.value).slice(0, 8);
    const preferredRoles = profile.preferredRoles.map((signal) => signal.value).slice(0, 4);
    const strengths = profile.strengths.map((signal) => signal.value).slice(0, 5);
    const roles = roleExperience.slice(0, 4).map((role) =>
        `${role.displayLabel}: ${role.years} years (${role.level})`
    );
    const parts = [
        profile.senioritySignal ? `Seniority: ${profile.senioritySignal}` : "",
        profile.profileSummaryText ? `Summary: ${profile.profileSummaryText}` : "",
        technologies.length > 0 ? `Technologies: ${technologies.join(", ")}` : "",
        preferredRoles.length > 0 ? `Preferred roles: ${preferredRoles.join(", ")}` : "",
        strengths.length > 0 ? `Strengths: ${strengths.join(", ")}` : "",
        roles.length > 0 ? `Role experience: ${roles.join("; ")}` : "",
    ].filter(Boolean);
    return parts.length > 0 ? parts.join("\n") : "No profile details are available; infer sensible options from the request.";
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
    const introduction = typeof parsed.introduction === "string" && parsed.introduction.trim().length > 0
        ? compactInterviewText(parsed.introduction, 240, 1)
        : "Here are the two strongest areas to begin with.";
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

    return {
        outcome,
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
