import type { TextCompletionPort } from "../../../litellm/text-completion/text-completion.types";
import type { UserAchievement } from "../../api/shared/chat.model";
import type { Conversation, DreamJobFlow } from "../../../routes/conversation/conversation.model";
import type {
    ChatTurnDecision,
    JobSearchResultItem,
    LlmDecision,
} from "../../api/shared/chat.types";
import type { ChatFlowDeps, SendMessageBaseContext } from "../../chat-flow.types";
import { getCurrentStage } from "../../../routes/conversation/conversation.stage.utils";
import { DEFAULT_MODE_DETECTION_RESULT } from "../../stage-1-prepare-context/mode-detection/conversation-mode.consts";
import { EMPTY_LLM_SEARCH_FILTERS } from "./chat.llm.consts";
import {
    parseChatTurnDecisionFromJson,
    parseLlmDecisionFromJson,
    resolveDecisionParseFallbackReply,
} from "./chat.llm.utils";
import { buildDreamJobPrompt } from "../../stage-2-shortcuts/dream-job/chat.dream-job.prompt.utils";
import {
    DREAM_JOB_LLM_PARSE_FALLBACK_REPLY,
    parseDreamJobLlmDecisionFromJson,
} from "../../stage-2-shortcuts/dream-job/chat.dream-job.llm.utils";
import type { DreamJobLlmDecision } from "../../stage-2-shortcuts/dream-job/chat.dream-job.types";
import { buildRecommendationPrompt } from "./chat.recommendation.prompt.utils";
import { buildTurnDecisionPrompt } from "./chat.turn.prompt.utils";
import type { ChatLlmObservedOperation, ChatLlmObserver } from "./chat.llm.types";
import { logLlmParseFailure } from "./chat.llm.validation.utils";

const recordParseEvent = (
    observer: ChatLlmObserver | undefined,
    operation: ChatLlmObservedOperation,
    rawText: string,
    parseStatus: "success" | "fallback"
): void => {
    observer?.recordParseEvent({ operation, rawText, parseStatus });
};

const buildJobAwareParseFallbackReply = (jobs: readonly JobSearchResultItem[]): string => {
    const focusJob = jobs[0];
    if (!focusJob) {
        return "I found matching roles, but I couldn't format the recommendation reliably.";
    }
    const company = focusJob.company.trim().length > 0 ? ` at ${focusJob.company.trim()}` : "";
    return `The strongest match I found is ${focusJob.title}${company}.`;
};

export const decideNextStep = async (
    deps: ChatFlowDeps,
    ctx: SendMessageBaseContext
): Promise<ChatTurnDecision> => {
    const conversation = ctx.conversationAfterUserMessage;
    const currentStage = getCurrentStage(conversation, ctx.normalizedMessage);
    const rawText = await deps.textCompletion.complete(
        buildTurnDecisionPrompt(
            conversation,
            ctx.normalizedMessage,
            ctx.userAchievements,
            ctx.userAccountContext,
            currentStage
        ),
        { operation: "chat.decision", userId: conversation.userId, sessionId: conversation._id?.toHexString(), feature: "chat" }
    );

    try {
        const parsed = parseChatTurnDecisionFromJson(rawText);
        recordParseEvent(deps.llmObserver, "chat.decision", rawText, "success");
        return parsed;
    } catch (error: unknown) {
        recordParseEvent(deps.llmObserver, "chat.decision", rawText, "fallback");
        logLlmParseFailure("chat.decision", rawText, error);
        return {
            reply: resolveDecisionParseFallbackReply(currentStage),
            shouldSearchJobs: false,
            recommendedJobIds: [],
            searchFilters: EMPTY_LLM_SEARCH_FILTERS,
            modeDetection: DEFAULT_MODE_DETECTION_RESULT,
            shouldAdvanceStage: false,
        };
    }
};

export const generateJobAwareReply = async (
    textCompletion: TextCompletionPort,
    conversation: Conversation,
    latestUserMessage: string,
    jobs: readonly JobSearchResultItem[],
    userAchievements: readonly UserAchievement[],
    userAccountContext?: string,
    observer?: ChatLlmObserver
): Promise<LlmDecision> => {
    const rawText = await textCompletion.complete(
        buildRecommendationPrompt(conversation, latestUserMessage, jobs, userAchievements, userAccountContext),
        { operation: "chat.job_aware_reply", userId: conversation.userId, sessionId: conversation._id?.toHexString(), feature: "chat" }
    );

    try {
        const parsed = parseLlmDecisionFromJson(rawText);
        recordParseEvent(observer, "chat.job_aware_reply", rawText, "success");
        return parsed;
    } catch (error: unknown) {
        recordParseEvent(observer, "chat.job_aware_reply", rawText, "fallback");
        logLlmParseFailure("chat.job_aware_reply", rawText, error);
        return {
            reply: buildJobAwareParseFallbackReply(jobs),
            shouldSearchJobs: false,
            recommendedJobIds: jobs.map((job) => job.id),
            searchFilters: EMPTY_LLM_SEARCH_FILTERS,
        };
    }
};

export const decideDreamJobStep = async (
    textCompletion: TextCompletionPort,
    conversation: Conversation,
    latestUserMessage: string,
    userAccountContext: string,
    dreamJobFlow: DreamJobFlow | undefined
): Promise<DreamJobLlmDecision> => {
    const rawText = await textCompletion.complete(
        buildDreamJobPrompt({ conversation, latestUserMessage, userAccountContext, dreamJobFlow }),
        { operation: "chat.dream_job", userId: conversation.userId, sessionId: conversation._id?.toHexString(), feature: "chat" }
    );

    try {
        return parseDreamJobLlmDecisionFromJson(rawText);
    } catch (error: unknown) {
        logLlmParseFailure("chat.dream_job", rawText, error);
        return {
            reply: DREAM_JOB_LLM_PARSE_FALLBACK_REPLY,
            awaitingConfirmation: false,
            userConfirmed: false,
        };
    }
};
