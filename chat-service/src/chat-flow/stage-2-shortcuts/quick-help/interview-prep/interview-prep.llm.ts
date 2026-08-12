import type { TextCompletionPort } from "../../../../litellm/text-completion/text-completion.types";
import { parseJsonObjectFromLlm } from "../../../shared/llm/json-response.utils";
import {
    QUICK_HELP_INTERVIEW_PLAN_ATTEMPTS,
    QUICK_HELP_INTERVIEW_QUESTION_COUNT,
    QUICK_HELP_INTERVIEW_QUESTION_MAX_CHARS,
} from "./interview-prep.consts";
import {
    buildInterviewGradePrompt,
    buildInterviewFocusSelectionPrompt,
    buildInterviewOptionsValidationPrompt,
    buildInterviewQuestionsPrompt,
    buildInterviewReconsiderationPrompt,
    buildInterviewTeachingPrompt,
    buildInterviewTopicPlanPrompt,
} from "./interview-prep.prompt.utils";
import type {
    InterviewFocusOption,
    InterviewFocusSelectionLlmResult,
    InterviewGradeLlmResult,
    InterviewQuestionsLlmResult,
    InterviewTeachingLlmResult,
    InterviewTopicPlanLlmResult,
} from "./interview-prep.types";
import {
    compactInterviewText,
    isAllowedSpokenInterviewQuestion,
    parseInterviewFocusSelection,
    parseInterviewGradeResult,
    parseInterviewTeachingResult,
    parseInterviewTopicPlan,
} from "./interview-prep.utils";

const requestInterviewTopicPlan = async (
    textCompletion: TextCompletionPort,
    params: { request: string; userId: string },
    attempt: number
): Promise<InterviewTopicPlanLlmResult> => {
    const raw = await textCompletion.complete(
        buildInterviewTopicPlanPrompt({ request: params.request }),
        { operation: "chat.quick_help.interview_plan", userId: params.userId, responseFormat: "json" }
    );
    const plan = parseInterviewTopicPlan(parseJsonObjectFromLlm(raw));
    if (plan.action === "start_practice") {
        return plan;
    }
    if (plan.action === "offer_options") {
        const validationRaw = await textCompletion.complete(
            buildInterviewOptionsValidationPrompt({ topic: params.request, options: plan.options }),
            { operation: "chat.quick_help.interview_options_validation", userId: params.userId, responseFormat: "json" }
        );
        const validation = parseJsonObjectFromLlm(validationRaw);
        if (validation?.withinTopic === true) {
            return plan;
        }
    }
    if (attempt >= QUICK_HELP_INTERVIEW_PLAN_ATTEMPTS) {
        return { action: "invalid" };
    }
    return requestInterviewTopicPlan(textCompletion, params, attempt + 1);
};

export const planInterviewTopic = async (
    textCompletion: TextCompletionPort,
    params: { request: string; userId: string }
): Promise<InterviewTopicPlanLlmResult> => requestInterviewTopicPlan(textCompletion, params, 1);

export const selectInterviewFocus = async (
    textCompletion: TextCompletionPort,
    params: {
        request: string;
        options: readonly InterviewFocusOption[];
        requireSingleSelection: boolean;
        userId: string;
    }
): Promise<InterviewFocusSelectionLlmResult> => {
    const raw = await textCompletion.complete(
        buildInterviewFocusSelectionPrompt(params),
        { operation: "chat.quick_help.interview_focus_selection", userId: params.userId, responseFormat: "json" }
    );
    return parseInterviewFocusSelection(parseJsonObjectFromLlm(raw), params.options);
};

export const generateInterviewQuestions = async (
    textCompletion: TextCompletionPort,
    params: { topic: string; difficulty: string; userId: string }
): Promise<InterviewQuestionsLlmResult> => {
    const raw = await textCompletion.complete(
        buildInterviewQuestionsPrompt({
            topic: params.topic,
            count: QUICK_HELP_INTERVIEW_QUESTION_COUNT,
            difficulty: params.difficulty,
        }),
        { operation: "chat.quick_help.interview_questions", userId: params.userId, responseFormat: "json" }
    );
    const parsed = parseJsonObjectFromLlm(raw);
    const generatedQuestions = Array.isArray(parsed?.questions)
        ? parsed.questions
              .filter(
                  (item): item is string =>
                      typeof item === "string" &&
                      item.trim().length > 0 &&
                      isAllowedSpokenInterviewQuestion(item)
              )
              .map((item) => compactInterviewText(item, QUICK_HELP_INTERVIEW_QUESTION_MAX_CHARS, 1))
              .slice(0, QUICK_HELP_INTERVIEW_QUESTION_COUNT)
        : [];
    const fallbackQuestions = [
        `What is ${params.topic}, in simple terms?`,
        `When would you choose ${params.topic} over a common alternative, and why?`,
        `What are two important tradeoffs or limitations related to ${params.topic}?`,
        `How would you explain a core concept in ${params.topic} to a non-technical interviewer?`,
        `What misconception do people often have about ${params.topic}?`,
    ];
    return { questions: [...generatedQuestions, ...fallbackQuestions].slice(0, QUICK_HELP_INTERVIEW_QUESTION_COUNT) };
};

export const gradeInterviewAnswer = async (
    textCompletion: TextCompletionPort,
    params: {
        topic: string;
        question: string;
        answer: string;
        userId: string;
        coachingContext?: {
            previousCandidateAnswer: string;
            previousFeedback: string;
        };
    }
): Promise<InterviewGradeLlmResult> => {
    const raw = await textCompletion.complete(
        buildInterviewGradePrompt({
            topic: params.topic,
            question: params.question,
            answer: params.answer,
            coachingContext: params.coachingContext,
        }),
        { operation: "chat.quick_help.interview_grade", userId: params.userId, responseFormat: "json" }
    );
    return parseInterviewGradeResult(parseJsonObjectFromLlm(raw));
};

export const evaluateInterviewTeachingReply = async (
    textCompletion: TextCompletionPort,
    params: {
        topic: string;
        interviewQuestion: string;
        explanation: string;
        example: string;
        understandingCheck: string;
        candidateReply: string;
        teachingAttemptCount: number;
        userId: string;
    }
): Promise<InterviewTeachingLlmResult> => {
    const raw = await textCompletion.complete(
        buildInterviewTeachingPrompt(params),
        { operation: "chat.quick_help.interview_teaching", userId: params.userId, responseFormat: "json" }
    );
    return parseInterviewTeachingResult(parseJsonObjectFromLlm(raw));
};

export const reconsiderInterviewAnswer = async (
    textCompletion: TextCompletionPort,
    params: {
        topic: string;
        question: string;
        answer: string;
        previousFeedback: string;
        challenge: string;
        userId: string;
    }
): Promise<InterviewGradeLlmResult> => {
    const raw = await textCompletion.complete(
        buildInterviewReconsiderationPrompt(params),
        { operation: "chat.quick_help.interview_reconsider", userId: params.userId, responseFormat: "json" }
    );
    return parseInterviewGradeResult(parseJsonObjectFromLlm(raw));
};
