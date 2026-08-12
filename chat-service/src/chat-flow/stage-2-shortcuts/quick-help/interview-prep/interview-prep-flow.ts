import type { ChatMessageResponse } from "../../../api/shared/chat.types";
import type { ChatFlowDeps, SendMessagePreparedContext } from "../../../chat-flow.types";
import { CONVERSATION_MODE } from "../../../stage-1-prepare-context/mode-detection/conversation-mode.consts";
import { sanitizeReply } from "../../../stage-6-present-jobs/presentation/chat.validation.service";
import type { InterviewPrepQuickHelpFlow } from "../../../../routes/conversation/conversation.types";
import { QUICK_HELP_EXIT_REPLY } from "../shared/quick-help.consts";
import { detectQuickHelpExitIntent } from "../shared/quick-help.utils";
import {
    QUICK_HELP_INTERVIEW_ASK_EXPERIENCE,
    QUICK_HELP_INTERVIEW_ASK_TOPIC,
    QUICK_HELP_INTERVIEW_MAX_FOLLOW_UPS,
    QUICK_HELP_INTERVIEW_MAX_TEACHING_ATTEMPTS,
    QUICK_HELP_INTERVIEW_QUESTION_COUNT,
} from "./interview-prep.consts";
import {
    evaluateInterviewTeachingReply,
    generateInterviewQuestion,
    gradeInterviewAnswer,
    planInterviewTopic,
    reconsiderInterviewAnswer,
    selectInterviewFocus,
} from "./interview-prep.llm";
import type {
    InterviewDifficulty,
    InterviewFocusOption,
    InterviewGradeLlmResult,
} from "./interview-prep.types";
import {
    completeInterviewQuestion,
    extractInterviewTopicCorrection,
    isExplicitInterviewKnowledgeGap,
    isInterviewFeedbackChallenge,
    isLegacyInterviewAcknowledgement,
    mapInterviewYearsToDifficulty,
    parseInterviewDifficulty,
    parseInterviewExperienceYears,
    resolveInterviewDifficulty,
    updateInterviewAttemptScores,
} from "./interview-prep.utils";

const formatQuestionPrompt = (index: number, total: number, question: string): string =>
    `Question ${index + 1}/${total}: ${question}`;

const formatFocusOptions = (options: readonly InterviewFocusOption[]): string =>
    options.map((option, index) => `${index + 1}. ${option.title}\n${option.description}`).join("\n\n");

const appendReply = async (
    deps: ChatFlowDeps,
    ctx: SendMessagePreparedContext,
    content: string
): Promise<ChatMessageResponse> => {
    const reply = sanitizeReply(content);
    await deps.conversationService.appendAssistantMessage(ctx.userId, ctx.conversationId, reply);
    return {
        reply,
        mode: CONVERSATION_MODE.INTERVIEW_PREP,
        confidenceSummary: ctx.confidenceSummary,
    };
};

const closeInterview = async (
    deps: ChatFlowDeps,
    ctx: SendMessagePreparedContext,
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

const finishInterview = async (
    deps: ChatFlowDeps,
    ctx: SendMessagePreparedContext,
    closing: string
): Promise<ChatMessageResponse> => {
    if (ctx.conversationAfterUserMessage.quickHelpFlow?.kind === "interview_prep") {
        const activeFlow = ctx.conversationAfterUserMessage.quickHelpFlow;
        if (activeFlow.deferredFocus) {
            await deps.conversationService.updateQuickHelpFlow(ctx.userId, ctx.conversationId, {
                kind: "interview_prep",
                step: "awaiting_saved_focus",
                topic: activeFlow.topic,
                baseTopic: activeFlow.baseTopic,
                deferredFocus: activeFlow.deferredFocus,
                difficulty: activeFlow.difficulty,
                startingDifficulty: activeFlow.startingDifficulty,
            });
            return appendReply(
                deps,
                ctx,
                `${closing}\n\nYou also chose ${activeFlow.deferredFocus.title} — ${activeFlow.deferredFocus.description}\nWould you like to practice it now?`
            );
        }
    }
    return closeInterview(deps, ctx, closing);
};

const moveToNextMainQuestion = async (
    deps: ChatFlowDeps,
    ctx: SendMessagePreparedContext,
    flow: InterviewPrepQuickHelpFlow,
    feedback: string
): Promise<ChatMessageResponse> => {
    const questions = flow.questions ?? [];
    const nextIndex = (flow.index ?? 0) + 1;
    const { questionResults, nextDifficulty } = completeInterviewQuestion({
        question: questions[flow.index ?? 0],
        difficulty: flow.difficulty ?? flow.startingDifficulty ?? "medium",
        attemptScores: flow.currentAttemptScores ?? [],
        questionResults: flow.questionResults ?? [],
    });
    const isLegacyFlow = flow.startingDifficulty === undefined;
    if (nextIndex >= QUICK_HELP_INTERVIEW_QUESTION_COUNT || (isLegacyFlow && nextIndex >= questions.length)) {
        return finishInterview(deps, ctx, `${feedback}\n\nNice work — that's the end of this practice set.`);
    }

    const isLegacyQuestionSet = isLegacyFlow && questions[nextIndex] !== undefined;
    const nextQuestion = isLegacyQuestionSet
        ? questions[nextIndex] ?? `Tell me about ${flow.topic ?? "this topic"}.`
        : await generateInterviewQuestion(deps.textCompletion, {
              topic: flow.questionContext ?? flow.topic ?? "this topic",
              difficulty: nextDifficulty,
              previousQuestions: questions,
              userId: ctx.userId,
          });
    const updatedQuestions = isLegacyQuestionSet ? questions : [...questions, nextQuestion];
    await deps.conversationService.updateQuickHelpFlow(ctx.userId, ctx.conversationId, {
        kind: "interview_prep",
        step: "awaiting_answer",
        topic: flow.topic,
        questions: updatedQuestions,
        index: nextIndex,
        baseTopic: flow.baseTopic,
        deferredFocus: flow.deferredFocus,
        difficulty: isLegacyQuestionSet ? flow.difficulty : nextDifficulty,
        startingDifficulty: flow.startingDifficulty,
        questionContext: flow.questionContext,
        questionResults,
        currentAttemptScores: [],
    });
    return appendReply(
        deps,
        ctx,
        `${feedback}\n\n${formatQuestionPrompt(
            nextIndex,
            isLegacyFlow ? questions.length : QUICK_HELP_INTERVIEW_QUESTION_COUNT,
            nextQuestion
        )}`
    );
};

const uniqueQuestions = (questions: readonly string[]): string[] =>
    [...new Set(questions.map((question) => question.trim()).filter(Boolean))];

const enterTeachingMode = async (
    deps: ChatFlowDeps,
    ctx: SendMessagePreparedContext,
    flow: InterviewPrepQuickHelpFlow,
    grade: InterviewGradeLlmResult,
    evaluatedQuestion: string
): Promise<ChatMessageResponse> => {
    await deps.conversationService.updateQuickHelpFlow(ctx.userId, ctx.conversationId, {
        kind: "interview_prep",
        step: "awaiting_teaching_check",
        topic: flow.topic,
        questions: flow.questions,
        index: flow.index,
        evaluatedQuestion,
        modelAnswer: grade.modelAnswer,
        improvementTip: grade.improvementTip,
        teachingExplanation: grade.teachingExplanation,
        teachingExample: grade.teachingExample,
        understandingCheck: grade.understandingCheck,
        teachingAttemptCount: 1,
        baseTopic: flow.baseTopic,
        deferredFocus: flow.deferredFocus,
        difficulty: flow.difficulty,
        startingDifficulty: flow.startingDifficulty,
        questionContext: flow.questionContext,
        questionResults: flow.questionResults,
        currentAttemptScores: flow.currentAttemptScores,
    });
    return appendReply(
        deps,
        ctx,
        `${grade.teachingExplanation}\n\nHere's a concrete example: ${grade.teachingExample}\n\nTo make sure it clicked: ${grade.understandingCheck}`
    );
};

const respondToGrade = async (
    deps: ChatFlowDeps,
    ctx: SendMessagePreparedContext,
    flow: InterviewPrepQuickHelpFlow,
    grade: InterviewGradeLlmResult,
    evaluatedQuestion: string,
    candidateAnswer: string,
    scoreMode: "append" | "replace" = "append"
): Promise<ChatMessageResponse> => {
    const scoredFlow = {
        ...flow,
        currentAttemptScores: updateInterviewAttemptScores(flow.currentAttemptScores ?? [], grade.score, scoreMode),
    };
    if (grade.outcome === "needs_teaching") {
        return enterTeachingMode(deps, ctx, scoredFlow, grade, evaluatedQuestion);
    }

    const existingFollowUps = scoredFlow.step === "awaiting_follow_up"
        ? scoredFlow.pendingFollowUpQuestions ?? []
        : [];
    const followUpCount = scoredFlow.step === "awaiting_follow_up" ? scoredFlow.followUpCount ?? 0 : 0;

    if (grade.outcome === "correct" && existingFollowUps.length === 0) {
        return moveToNextMainQuestion(deps, ctx, scoredFlow, grade.feedback);
    }

    const generatedFollowUps = grade.outcome === "correct" ? [] : grade.followUpQuestions;
    const pendingFollowUps = uniqueQuestions([...existingFollowUps, ...generatedFollowUps]);
    const fallbackFollowUp = `What would you add to make your answer fully address: ${evaluatedQuestion}`;
    const nextFollowUp = pendingFollowUps[0] ?? (grade.outcome === "correct" ? undefined : fallbackFollowUp);

    if (nextFollowUp && followUpCount < QUICK_HELP_INTERVIEW_MAX_FOLLOW_UPS) {
        await deps.conversationService.updateQuickHelpFlow(ctx.userId, ctx.conversationId, {
            kind: "interview_prep",
            step: "awaiting_follow_up",
            topic: scoredFlow.topic,
            questions: scoredFlow.questions,
            index: scoredFlow.index,
            evaluatedQuestion,
            candidateAnswer,
            lastFeedback: grade.feedback,
            modelAnswer: grade.modelAnswer,
            improvementTip: grade.improvementTip,
            activeFollowUpQuestion: nextFollowUp,
            pendingFollowUpQuestions: pendingFollowUps.slice(1),
            followUpCount: followUpCount + 1,
            baseTopic: scoredFlow.baseTopic,
            deferredFocus: scoredFlow.deferredFocus,
            difficulty: scoredFlow.difficulty,
            startingDifficulty: scoredFlow.startingDifficulty,
            questionContext: scoredFlow.questionContext,
            questionResults: scoredFlow.questionResults,
            currentAttemptScores: scoredFlow.currentAttemptScores,
        });
        return appendReply(deps, ctx, `${grade.feedback}\n\n${nextFollowUp}`);
    }

    const summary = `${grade.feedback}\n\nHere's how I'd shape it into a polished interview answer: ${grade.modelAnswer}\n\nFor the next one, ${grade.improvementTip}`;
    return moveToNextMainQuestion(deps, ctx, scoredFlow, summary);
};

const startQuestionSet = async (
    deps: ChatFlowDeps,
    ctx: SendMessagePreparedContext,
    params: {
        topic: string;
        questionContext?: string;
        baseTopic?: string;
        deferredFocus?: InterviewFocusOption;
        difficulty: InterviewDifficulty;
    }
): Promise<ChatMessageResponse> => {
    const questionContext = params.questionContext ?? params.topic;
    const firstQuestion = await generateInterviewQuestion(deps.textCompletion, {
        topic: questionContext,
        difficulty: params.difficulty,
        previousQuestions: [],
        userId: ctx.userId,
    });
    await deps.conversationService.updateQuickHelpFlow(ctx.userId, ctx.conversationId, {
        kind: "interview_prep",
        step: "awaiting_answer",
        topic: params.topic,
        questions: [firstQuestion],
        index: 0,
        baseTopic: params.baseTopic,
        deferredFocus: params.deferredFocus,
        difficulty: params.difficulty,
        startingDifficulty: params.difficulty,
        questionContext,
        questionResults: [],
        currentAttemptScores: [],
    });
    return appendReply(
        deps,
        ctx,
        `Great — we'll practice ${params.topic}.\n\n${formatQuestionPrompt(0, QUICK_HELP_INTERVIEW_QUESTION_COUNT, firstQuestion)}`
    );
};

const prepareInterviewTopic = async (
    deps: ChatFlowDeps,
    ctx: SendMessagePreparedContext,
    request: string,
    difficulty: InterviewDifficulty
): Promise<ChatMessageResponse> => {
    const plan = await planInterviewTopic(deps.textCompletion, { request, userId: ctx.userId });
    if (plan.action === "offer_options") {
        await deps.conversationService.updateQuickHelpFlow(ctx.userId, ctx.conversationId, {
            kind: "interview_prep",
            step: "awaiting_focus",
            topic: request,
            baseTopic: request,
            focusOptions: plan.options,
            difficulty,
        });
        return appendReply(
            deps,
            ctx,
            `${plan.introduction}\n\n${formatFocusOptions(plan.options)}\n\nWhich option should we start with?`
        );
    }
    if (plan.action === "start_practice") {
        return startQuestionSet(deps, ctx, { topic: request, baseTopic: request, difficulty });
    }
    return appendReply(
        deps,
        ctx,
        `I couldn't create two reliable choices within ${request}. Which specific area within that topic would you like to practice?`
    );
};

const getPreviousTurnContent = (
    ctx: SendMessagePreparedContext,
    role: "user" | "assistant"
): string | undefined => {
    const matchingMessages = ctx.conversationAfterUserMessage.messages.filter((message) => message.role === role);
    const offset = role === "user" ? 2 : 1;
    return matchingMessages.at(-offset)?.content;
};

export const runInterviewPrepFlow = async (
    deps: ChatFlowDeps,
    ctx: SendMessagePreparedContext,
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
        return appendReply(deps, ctx, QUICK_HELP_INTERVIEW_ASK_TOPIC);
    }

    const activeFlow: InterviewPrepQuickHelpFlow = flow;
    if (activeFlow.step === "awaiting_topic") {
        const request = ctx.normalizedMessage.trim();
        const difficulty = resolveInterviewDifficulty(request, ctx.userRoleExperience);
        if (!difficulty) {
            await deps.conversationService.updateQuickHelpFlow(ctx.userId, ctx.conversationId, {
                kind: "interview_prep",
                step: "awaiting_experience",
                topic: request,
                baseTopic: request,
            });
            return appendReply(deps, ctx, QUICK_HELP_INTERVIEW_ASK_EXPERIENCE(request));
        }
        return prepareInterviewTopic(deps, ctx, request, difficulty);
    }

    if (activeFlow.step === "awaiting_experience") {
        const request = activeFlow.baseTopic ?? activeFlow.topic;
        if (!request) {
            return appendReply(deps, ctx, QUICK_HELP_INTERVIEW_ASK_TOPIC);
        }
        const statedDifficulty = parseInterviewDifficulty(ctx.normalizedMessage);
        const statedYears = parseInterviewExperienceYears(ctx.normalizedMessage);
        const difficulty = statedDifficulty ?? (statedYears === undefined
            ? undefined
            : mapInterviewYearsToDifficulty(statedYears));
        if (!difficulty) {
            return appendReply(deps, ctx, QUICK_HELP_INTERVIEW_ASK_EXPERIENCE(request));
        }
        return prepareInterviewTopic(deps, ctx, request, difficulty);
    }

    if (activeFlow.step === "awaiting_focus" || activeFlow.step === "awaiting_first_focus") {
        const correctedTopic = extractInterviewTopicCorrection(ctx.normalizedMessage);
        if (correctedTopic) {
            const correctedDifficulty = resolveInterviewDifficulty(correctedTopic, ctx.userRoleExperience);
            if (!correctedDifficulty) {
                await deps.conversationService.updateQuickHelpFlow(ctx.userId, ctx.conversationId, {
                    kind: "interview_prep",
                    step: "awaiting_experience",
                    topic: correctedTopic,
                    baseTopic: correctedTopic,
                });
                return appendReply(deps, ctx, QUICK_HELP_INTERVIEW_ASK_EXPERIENCE(correctedTopic));
            }
            return prepareInterviewTopic(deps, ctx, correctedTopic, correctedDifficulty);
        }
        const options = activeFlow.focusOptions;
        if (!options) {
            await deps.conversationService.updateQuickHelpFlow(ctx.userId, ctx.conversationId, {
                kind: "interview_prep",
                step: "awaiting_topic",
            });
            return appendReply(deps, ctx, QUICK_HELP_INTERVIEW_ASK_TOPIC);
        }
        const selection = await selectInterviewFocus(deps.textCompletion, {
            request: ctx.normalizedMessage,
            options,
            requireSingleSelection: activeFlow.step === "awaiting_first_focus",
            userId: ctx.userId,
        });
        if (selection.kind === "declined") {
            return finishInterview(deps, ctx, "No problem — we can stop interview practice here.");
        }
        if (selection.kind === "both" && activeFlow.step === "awaiting_focus") {
            await deps.conversationService.updateQuickHelpFlow(ctx.userId, ctx.conversationId, {
                ...activeFlow,
                step: "awaiting_first_focus",
            });
            return appendReply(
                deps,
                ctx,
                `We'll cover both. Which one should we start with?\n\n${formatFocusOptions(options)}`
            );
        }
        if (selection.kind !== "selected") {
            return appendReply(
                deps,
                ctx,
                `I couldn't tell which option you chose. Please pick one:\n\n${formatFocusOptions(options)}`
            );
        }
        const selectedOption = options.find((option) => option.id === selection.selectedOptionId);
        if (!selectedOption) {
            return appendReply(deps, ctx, `Please pick one:\n\n${formatFocusOptions(options)}`);
        }
        const deferredFocus = activeFlow.step === "awaiting_first_focus"
            ? options.find((option) => option.id !== selectedOption.id)
            : undefined;
        const baseTopic = activeFlow.baseTopic ?? activeFlow.topic ?? "interview practice";
        return startQuestionSet(deps, ctx, {
            topic: `${selectedOption.title} for ${baseTopic}`,
            questionContext: `${selectedOption.title} for ${baseTopic}. Focus: ${selectedOption.description}`,
            baseTopic,
            deferredFocus,
            difficulty: activeFlow.difficulty ?? "medium",
        });
    }

    if (activeFlow.step === "awaiting_saved_focus") {
        const savedFocus = activeFlow.deferredFocus;
        if (!savedFocus) {
            return finishInterview(deps, ctx, "That completes this interview practice session.");
        }
        const selection = await selectInterviewFocus(deps.textCompletion, {
            request: ctx.normalizedMessage,
            options: [savedFocus],
            requireSingleSelection: true,
            userId: ctx.userId,
        });
        if (selection.kind === "declined") {
            return closeInterview(deps, ctx, "No problem — that completes this interview practice session.");
        }
        if (selection.kind !== "selected") {
            return appendReply(
                deps,
                ctx,
                `Would you like to practice ${savedFocus.title} — ${savedFocus.description}?`
            );
        }
        const baseTopic = activeFlow.baseTopic ?? "interview practice";
        return startQuestionSet(deps, ctx, {
            topic: `${savedFocus.title} for ${baseTopic}`,
            questionContext: `${savedFocus.title} for ${baseTopic}. Focus: ${savedFocus.description}`,
            baseTopic,
            difficulty: activeFlow.startingDifficulty ?? activeFlow.difficulty ?? "medium",
        });
    }

    const questions = activeFlow.questions ?? [];
    const index = activeFlow.index ?? 0;
    const mainQuestion = questions[index] ?? `Tell me about ${activeFlow.topic ?? "this topic"}.`;
    const isChallenge = isInterviewFeedbackChallenge(ctx.normalizedMessage);

    if (activeFlow.step === "awaiting_teaching_check") {
        const teachingAttemptCount = activeFlow.teachingAttemptCount ?? 1;
        const teachingResult = await evaluateInterviewTeachingReply(deps.textCompletion, {
            topic: activeFlow.topic ?? "this topic",
            interviewQuestion: activeFlow.evaluatedQuestion ?? mainQuestion,
            explanation: activeFlow.teachingExplanation ?? "A simple explanation was provided.",
            example: activeFlow.teachingExample ?? "A short example was provided.",
            understandingCheck: activeFlow.understandingCheck ?? "Explain the core idea in your own words.",
            candidateReply: ctx.normalizedMessage,
            teachingAttemptCount,
            userId: ctx.userId,
        });

        if (teachingResult.status === "understood") {
            await deps.conversationService.updateQuickHelpFlow(ctx.userId, ctx.conversationId, {
                kind: "interview_prep",
                step: "awaiting_answer",
                topic: activeFlow.topic,
                questions,
                index,
                baseTopic: activeFlow.baseTopic,
                deferredFocus: activeFlow.deferredFocus,
                difficulty: activeFlow.difficulty,
                startingDifficulty: activeFlow.startingDifficulty,
                questionContext: activeFlow.questionContext,
                questionResults: activeFlow.questionResults,
                currentAttemptScores: activeFlow.currentAttemptScores,
            });
            return appendReply(
                deps,
                ctx,
                `${teachingResult.response}\n\nNow try the interview question again: ${mainQuestion}`
            );
        }

        if (
            teachingResult.status === "needs_reteaching" &&
            teachingAttemptCount >= QUICK_HELP_INTERVIEW_MAX_TEACHING_ATTEMPTS
        ) {
            const modelAnswer = activeFlow.modelAnswer ?? "State the core idea clearly and connect it to the question.";
            const improvementTip = activeFlow.improvementTip ?? "Use one definition and one example.";
            const summary = `${teachingResult.response}\n\nHere's how you could say it in the interview: ${modelAnswer}\n\nFor the next one, ${improvementTip}`;
            return moveToNextMainQuestion(deps, ctx, activeFlow, summary);
        }

        const nextAttemptCount = teachingResult.status === "needs_reteaching"
            ? teachingAttemptCount + 1
            : teachingAttemptCount;
        const nextExplanation = teachingResult.status === "asks_question"
            ? activeFlow.teachingExplanation ?? teachingResult.explanation
            : teachingResult.explanation;
        const nextExample = teachingResult.status === "asks_question"
            ? activeFlow.teachingExample ?? teachingResult.example
            : teachingResult.example;
        await deps.conversationService.updateQuickHelpFlow(ctx.userId, ctx.conversationId, {
            ...activeFlow,
            step: "awaiting_teaching_check",
            teachingExplanation: nextExplanation,
            teachingExample: nextExample,
            understandingCheck: teachingResult.understandingCheck,
            teachingAttemptCount: nextAttemptCount,
        });
        const teachingContent = teachingResult.status === "asks_question"
            ? `${teachingResult.response}\n\nTo make sure it clicked: ${teachingResult.understandingCheck}`
            : `${teachingResult.response}\n\n${teachingResult.explanation}\n\nHere's another example: ${teachingResult.example}\n\nTo make sure it clicked: ${teachingResult.understandingCheck}`;
        return appendReply(deps, ctx, teachingContent);
    }

    if (activeFlow.step === "awaiting_ack" && isLegacyInterviewAcknowledgement(ctx.normalizedMessage)) {
        return moveToNextMainQuestion(deps, ctx, activeFlow, "Let's continue.");
    }

    if ((activeFlow.step === "awaiting_follow_up" || activeFlow.step === "awaiting_ack") && isChallenge) {
        const evaluatedQuestion = activeFlow.evaluatedQuestion ?? mainQuestion;
        const candidateAnswer = activeFlow.candidateAnswer ?? getPreviousTurnContent(ctx, "user") ?? "Original answer unavailable";
        const previousFeedback = activeFlow.lastFeedback ?? getPreviousTurnContent(ctx, "assistant") ?? "Previous feedback unavailable";
        const reconsidered = await reconsiderInterviewAnswer(deps.textCompletion, {
            topic: activeFlow.topic ?? "this topic",
            question: evaluatedQuestion,
            answer: candidateAnswer,
            previousFeedback,
            challenge: ctx.normalizedMessage,
            userId: ctx.userId,
        });
        const reconsideredFlow = {
            ...activeFlow,
            currentAttemptScores: updateInterviewAttemptScores(
                activeFlow.currentAttemptScores ?? [],
                reconsidered.score,
                "replace"
            ),
        };

        if (reconsidered.outcome === "correct") {
            return moveToNextMainQuestion(deps, ctx, reconsideredFlow, reconsidered.feedback);
        }

        if (activeFlow.activeFollowUpQuestion) {
            await deps.conversationService.updateQuickHelpFlow(ctx.userId, ctx.conversationId, {
                ...reconsideredFlow,
                step: "awaiting_follow_up",
                lastFeedback: reconsidered.feedback,
                modelAnswer: reconsidered.modelAnswer,
                improvementTip: reconsidered.improvementTip,
            });
            return appendReply(
                deps,
                ctx,
                `${reconsidered.feedback}\n\n${activeFlow.activeFollowUpQuestion}`
            );
        }

        return respondToGrade(
            deps,
            ctx,
            activeFlow,
            reconsidered,
            evaluatedQuestion,
            candidateAnswer,
            "replace"
        );
    }

    const evaluatedQuestion = activeFlow.step === "awaiting_follow_up"
        ? activeFlow.activeFollowUpQuestion ?? mainQuestion
        : mainQuestion;
    const grade = await gradeInterviewAnswer(deps.textCompletion, {
        topic: activeFlow.topic ?? "this topic",
        question: evaluatedQuestion,
        answer: ctx.normalizedMessage,
        userId: ctx.userId,
        coachingContext: activeFlow.step === "awaiting_follow_up"
            ? {
                  previousCandidateAnswer: activeFlow.candidateAnswer ?? "Previous answer unavailable",
                  previousFeedback: activeFlow.lastFeedback ?? "Previous feedback unavailable",
              }
            : undefined,
    });
    const effectiveGrade: InterviewGradeLlmResult = isExplicitInterviewKnowledgeGap(ctx.normalizedMessage)
        ? { ...grade, outcome: "needs_teaching", score: 0, feedback: "", followUpQuestions: [] }
        : grade;
    return respondToGrade(deps, ctx, activeFlow, effectiveGrade, evaluatedQuestion, ctx.normalizedMessage);
};
