import type { TextCompletionPort } from "../../../litellm/text-completion/text-completion.types";
import type { UserAchievement } from "../../api/shared/chat.model";
import type { Conversation, DreamJobFlow } from "../../../routes/conversation/conversation.model";
import type {
    ChatTurnDecision,
    JobSearchResultItem,
    LlmDecision,
} from "../../api/shared/chat.types";
import type { ChatFlowDeps, SendMessageBaseContext } from "../../chat-flow.types";
import { DEFAULT_MODE_DETECTION_RESULT } from "../../stage-1-prepare-context/mode-detection/conversation-mode.consts";
import {
    EMPTY_LLM_SEARCH_FILTERS,
    LLM_DECISION_PARSE_FALLBACK_REPLY,
    LLM_JOB_AWARE_PARSE_FALLBACK_REPLY,
} from "./chat.llm.consts";
import {
    parseChatTurnDecisionFromJson,
    parseLlmDecisionFromJson,
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
import { getCurrentStage } from "../../../routes/conversation/conversation.stage.utils";

const recordParseEvent = (
    observer: ChatLlmObserver | undefined,
    operation: ChatLlmObservedOperation,
    rawText: string,
    parseStatus: "success" | "fallback"
): void => {
    observer?.recordParseEvent({ operation, rawText, parseStatus });
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
    } catch {
        recordParseEvent(deps.llmObserver, "chat.decision", rawText, "fallback");
        return {
            reply: LLM_DECISION_PARSE_FALLBACK_REPLY,
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
    } catch {
        recordParseEvent(observer, "chat.job_aware_reply", rawText, "fallback");
        return {
            reply: LLM_JOB_AWARE_PARSE_FALLBACK_REPLY,
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
    } catch {
        return {
            reply: DREAM_JOB_LLM_PARSE_FALLBACK_REPLY,
            awaitingConfirmation: false,
            userConfirmed: false,
        };
    }
};
