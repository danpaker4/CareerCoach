import type { ChatMessageResponse } from "../../../api/shared/chat.types";
import type { ChatFlowDeps, SendMessageBaseContext } from "../../../chat-flow.types";
import { CONVERSATION_MODE } from "../../../stage-1-prepare-context/mode-detection/conversation-mode.consts";
import { sanitizeReply } from "../../../stage-6-present-jobs/presentation/chat.validation.service";
import type { InterviewPrepQuickHelpFlow } from "../../../../routes/conversation/conversation.types";
import { QUICK_HELP_EXIT_REPLY } from "../shared/quick-help.consts";
import { detectQuickHelpExitIntent } from "../shared/quick-help.utils";
import { QUICK_HELP_INTERVIEW_ASK_TOPIC } from "./interview-prep.consts";
import { generateInterviewQuestions, gradeInterviewAnswer } from "./interview-prep.llm";
import { isInterviewAckMessage } from "./interview-prep.utils";

const formatQuestionPrompt = (index: number, total: number, question: string): string =>
    `Question ${index + 1}/${total}: ${question}`;

const finishInterview = async (
    deps: ChatFlowDeps,
    ctx: SendMessageBaseContext,
    closing: string
): Promise<ChatMessageResponse> => {
    const reply = sanitizeReply(closing);
    await deps.conversationService.updateQuickHelpFlow(ctx.userId, ctx.conversationId, undefined);
    await deps.conversationService.appendAssistantMessage(ctx.userId, ctx.conversationId, reply);
    return {
        reply,
        mode: CONVERSATION_MODE.GUIDED,
        confidenceSummary: ctx.confidenceSummary,
    };
};

export const runInterviewPrepFlow = async (
    deps: ChatFlowDeps,
    ctx: SendMessageBaseContext,
    isNewIntent: boolean
): Promise<ChatMessageResponse> => {
    const flow = ctx.conversationAfterUserMessage.quickHelpFlow;

    if (detectQuickHelpExitIntent(ctx.normalizedMessage) && !isNewIntent) {
        await deps.conversationService.updateQuickHelpFlow(ctx.userId, ctx.conversationId, undefined);
        await deps.conversationService.appendAssistantMessage(ctx.userId, ctx.conversationId, QUICK_HELP_EXIT_REPLY);
        return {
            reply: QUICK_HELP_EXIT_REPLY,
            mode: CONVERSATION_MODE.GUIDED,
            confidenceSummary: ctx.confidenceSummary,
        };
    }

    if (isNewIntent || flow?.kind !== "interview_prep") {
        await deps.conversationService.updateQuickHelpFlow(ctx.userId, ctx.conversationId, {
            kind: "interview_prep",
            step: "awaiting_topic",
        });
        await deps.conversationService.appendAssistantMessage(
            ctx.userId,
            ctx.conversationId,
            QUICK_HELP_INTERVIEW_ASK_TOPIC
        );
        return {
            reply: QUICK_HELP_INTERVIEW_ASK_TOPIC,
            mode: CONVERSATION_MODE.INTERVIEW_PREP,
            confidenceSummary: ctx.confidenceSummary,
        };
    }

    const activeFlow: InterviewPrepQuickHelpFlow = flow;

    if (activeFlow.step === "awaiting_topic") {
        const topic = ctx.normalizedMessage.trim();
        const generated = await generateInterviewQuestions(deps.textCompletion, {
            topic,
            userId: ctx.userId,
        });
        const questions = generated.questions;
        const first = questions[0] ?? `Tell me about your experience with ${topic}.`;
        const nextFlow: InterviewPrepQuickHelpFlow = {
            kind: "interview_prep",
            step: "awaiting_answer",
            topic,
            questions,
            index: 0,
        };
        await deps.conversationService.updateQuickHelpFlow(ctx.userId, ctx.conversationId, nextFlow);
        const reply = `Great — we'll practice ${topic}.\n\n${formatQuestionPrompt(0, questions.length, first)}`;
        await deps.conversationService.appendAssistantMessage(ctx.userId, ctx.conversationId, reply);
        return {
            reply,
            mode: CONVERSATION_MODE.INTERVIEW_PREP,
            confidenceSummary: ctx.confidenceSummary,
        };
    }

    const topic = activeFlow.topic ?? "this topic";
    const questions = activeFlow.questions ?? [];
    const index = activeFlow.index ?? 0;
    const currentQuestion = questions[index] ?? `Tell me about ${topic}.`;

    if (activeFlow.step === "awaiting_ack") {
        if (!isInterviewAckMessage(ctx.normalizedMessage)) {
            const reply =
                "Take a moment with that explanation. Reply when you understand (for example: \"got it\" or \"I understand\") and have no more questions on this one.";
            await deps.conversationService.appendAssistantMessage(ctx.userId, ctx.conversationId, reply);
            return {
                reply,
                mode: CONVERSATION_MODE.INTERVIEW_PREP,
                confidenceSummary: ctx.confidenceSummary,
            };
        }

        const nextIndex = index + 1;
        if (nextIndex >= questions.length) {
            return finishInterview(
                deps,
                ctx,
                "Nice work — that wraps this interview practice set. Want to try another topic later, just ask."
            );
        }

        const nextQuestion = questions[nextIndex] ?? `Another question about ${topic}?`;
        await deps.conversationService.updateQuickHelpFlow(ctx.userId, ctx.conversationId, {
            kind: "interview_prep",
            step: "awaiting_answer",
            topic,
            questions,
            index: nextIndex,
        });
        const reply = formatQuestionPrompt(nextIndex, questions.length, nextQuestion);
        await deps.conversationService.appendAssistantMessage(ctx.userId, ctx.conversationId, reply);
        return {
            reply,
            mode: CONVERSATION_MODE.INTERVIEW_PREP,
            confidenceSummary: ctx.confidenceSummary,
        };
    }

    const grade = await gradeInterviewAnswer(deps.textCompletion, {
        topic,
        question: currentQuestion,
        answer: ctx.normalizedMessage,
        userId: ctx.userId,
    });

    if (grade.correct) {
        const nextIndex = index + 1;
        if (nextIndex >= questions.length) {
            return finishInterview(
                deps,
                ctx,
                `${sanitizeReply(grade.feedback)}\n\nYou're done with this practice set — solid work.`
            );
        }
        const nextQuestion = questions[nextIndex] ?? `Another question about ${topic}?`;
        await deps.conversationService.updateQuickHelpFlow(ctx.userId, ctx.conversationId, {
            kind: "interview_prep",
            step: "awaiting_answer",
            topic,
            questions,
            index: nextIndex,
        });
        const reply = `${sanitizeReply(grade.feedback)}\n\n${formatQuestionPrompt(nextIndex, questions.length, nextQuestion)}`;
        await deps.conversationService.appendAssistantMessage(ctx.userId, ctx.conversationId, reply);
        return {
            reply,
            mode: CONVERSATION_MODE.INTERVIEW_PREP,
            confidenceSummary: ctx.confidenceSummary,
        };
    }

    await deps.conversationService.updateQuickHelpFlow(ctx.userId, ctx.conversationId, {
        kind: "interview_prep",
        step: "awaiting_ack",
        topic,
        questions,
        index,
    });
    const reply = `${sanitizeReply(grade.feedback)}\n\nWhen you understand and don't have more questions on this one, reply with \"got it\" and we'll continue.`;
    await deps.conversationService.appendAssistantMessage(ctx.userId, ctx.conversationId, reply);
    return {
        reply,
        mode: CONVERSATION_MODE.INTERVIEW_PREP,
        confidenceSummary: ctx.confidenceSummary,
    };
};
