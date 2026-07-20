import type { TextCompletionPort } from "../../../litellm/text-completion/text-completion.types";
import type { UserAchievement } from "../../api/shared/chat.model";
import type { Conversation, DreamJobFlow } from "../../../routes/conversation/conversation.model";
import type { ConversationStage } from "../../../routes/conversation/conversation.types";
import type { JobSearchResultItem, LlmDecision, StageLlmDecision } from "../../api/shared/chat.types";
import type { ConversationMode } from "../../stage-1-prepare-context/mode-detection/conversation-mode.types";
import { DEFAULT_CONVERSATION_MODE } from "../../stage-1-prepare-context/mode-detection/conversation-mode.consts";
import {
    EMPTY_LLM_SEARCH_FILTERS,
    LLM_DECISION_PARSE_FALLBACK_REPLY,
    LLM_JOB_AWARE_PARSE_FALLBACK_REPLY,
    LLM_STAGE_PARSE_FALLBACK_REPLY,
} from "./chat.llm.consts";
import { parseLlmDecisionFromJson, parseStageLlmDecisionFromJson } from "./chat.llm.utils";
import { buildDreamJobPrompt } from "../../stage-2-shortcuts/dream-job/chat.dream-job.prompt.utils";
import {
    DREAM_JOB_LLM_PARSE_FALLBACK_REPLY,
    parseDreamJobLlmDecisionFromJson,
} from "../../stage-2-shortcuts/dream-job/chat.dream-job.llm.utils";
import type { DreamJobLlmDecision } from "../../stage-2-shortcuts/dream-job/chat.dream-job.types";
import { buildDecisionPrompt, buildRecommendationPrompt, buildStagePrompt } from "./chat.prompt.utils";
import type { ChatLlmObservedOperation, ChatLlmObserver } from "./chat.llm.types";

const recordParseEvent = (
    observer: ChatLlmObserver | undefined,
    operation: ChatLlmObservedOperation,
    rawText: string,
    parseStatus: "success" | "fallback"
): void => {
    observer?.recordParseEvent({ operation, rawText, parseStatus });
};

export const decideNextStep = async (
    textCompletion: TextCompletionPort,
    conversation: Conversation,
    latestUserMessage: string,
    userAchievements: readonly UserAchievement[],
    userAccountContext?: string,
    observer?: ChatLlmObserver
): Promise<LlmDecision> => {
    const rawText = await textCompletion.complete(
        buildDecisionPrompt(conversation, latestUserMessage, userAchievements, userAccountContext),
        { operation: "chat.decision", userId: conversation.userId }
    );

    try {
        const parsed = parseLlmDecisionFromJson(rawText);
        recordParseEvent(observer, "chat.decision", rawText, "success");
        return parsed;
    } catch {
        recordParseEvent(observer, "chat.decision", rawText, "fallback");
        return {
            reply: LLM_DECISION_PARSE_FALLBACK_REPLY,
            shouldSearchJobs: false,
            recommendedJobIds: [],
            searchFilters: EMPTY_LLM_SEARCH_FILTERS,
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
        { operation: "chat.job_aware_reply", userId: conversation.userId }
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
        { operation: "chat.dream_job", userId: conversation.userId }
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

export const generateStageReply = async (
    textCompletion: TextCompletionPort,
    conversation: Conversation,
    latestUserMessage: string,
    stage: ConversationStage,
    userAchievements: readonly UserAchievement[],
    mode: ConversationMode = DEFAULT_CONVERSATION_MODE,
    userAccountContext?: string,
    observer?: ChatLlmObserver
): Promise<StageLlmDecision> => {
    const rawText = await textCompletion.complete(
        buildStagePrompt(conversation, latestUserMessage, stage, userAchievements, mode, userAccountContext),
        { operation: "chat.stage_reply", userId: conversation.userId }
    );
    try {
        const parsed = parseStageLlmDecisionFromJson(rawText);
        recordParseEvent(observer, "chat.stage_reply", rawText, "success");
        return parsed;
    } catch {
        recordParseEvent(observer, "chat.stage_reply", rawText, "fallback");
        return {
            reply: LLM_STAGE_PARSE_FALLBACK_REPLY,
            shouldAdvanceStage: false,
        };
    }
};
