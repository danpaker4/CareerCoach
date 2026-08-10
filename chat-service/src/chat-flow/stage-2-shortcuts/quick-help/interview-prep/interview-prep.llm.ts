import type { TextCompletionPort } from "../../../../litellm/text-completion/text-completion.types";
import { parseJsonObjectFromLlm } from "../../../shared/llm/json-response.utils";
import { QUICK_HELP_INTERVIEW_QUESTION_COUNT } from "./interview-prep.consts";
import { buildInterviewGradePrompt, buildInterviewQuestionsPrompt } from "./interview-prep.prompt.utils";
import type { InterviewGradeLlmResult, InterviewQuestionsLlmResult } from "./interview-prep.types";
import { isClearlyInsufficientInterviewAnswer } from "./interview-prep.utils";

export const generateInterviewQuestions = async (
    textCompletion: TextCompletionPort,
    params: { topic: string; userId: string }
): Promise<InterviewQuestionsLlmResult> => {
    const raw = await textCompletion.complete(
        buildInterviewQuestionsPrompt({ topic: params.topic, count: QUICK_HELP_INTERVIEW_QUESTION_COUNT }),
        { operation: "chat.quick_help.interview_questions", userId: params.userId, responseFormat: "json" }
    );
    const parsed = parseJsonObjectFromLlm(raw);
    const questions = Array.isArray(parsed?.questions)
        ? parsed.questions
              .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
              .map((item) => item.trim())
              .slice(0, QUICK_HELP_INTERVIEW_QUESTION_COUNT)
        : [];
    if (questions.length > 0) {
        return { questions };
    }
    return {
        questions: [
            `What is ${params.topic}, in simple terms?`,
            `When would you choose ${params.topic} over a common alternative, and why?`,
            `What are two important tradeoffs or limitations related to ${params.topic}?`,
            `How would you explain a core concept in ${params.topic} to a non-technical interviewer?`,
            `What misconception do people often have about ${params.topic}?`,
        ],
    };
};

export const gradeInterviewAnswer = async (
    textCompletion: TextCompletionPort,
    params: { topic: string; question: string; answer: string; userId: string }
): Promise<InterviewGradeLlmResult> => {
    if (isClearlyInsufficientInterviewAnswer(params.answer)) {
        return {
            correct: false,
            feedback:
                "Incorrect — that answer is too thin or unclear. Give a short conceptual explanation that directly answers the question.",
        };
    }

    const raw = await textCompletion.complete(
        buildInterviewGradePrompt({
            topic: params.topic,
            question: params.question,
            answer: params.answer,
        }),
        { operation: "chat.quick_help.interview_grade", userId: params.userId, responseFormat: "json" }
    );
    const parsed = parseJsonObjectFromLlm(raw);
    const feedback =
        typeof parsed?.feedback === "string" && parsed.feedback.trim().length > 0
            ? parsed.feedback.trim()
            : "Incorrect — try again with a clearer conceptual answer.";
    const correct = parsed?.correct === true;
    if (correct) {
        return { correct: true, feedback };
    }
    const withIncorrectLabel = /\bincorrect\b/i.test(feedback) ? feedback : `Incorrect. ${feedback}`;
    return { correct: false, feedback: withIncorrectLabel };
};
