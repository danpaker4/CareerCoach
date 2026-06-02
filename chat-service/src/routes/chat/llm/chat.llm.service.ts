import type { TextCompletionPort } from "../../../ai/ports/text-completion.types";
import type { UserAchievement } from "../chat.model";
import type { Conversation } from "../../conversation/conversation.model";
import type { ConversationStage } from "../../conversation/conversation.stage.consts";
import type { JobSearchResultItem, LlmDecision, StageLlmDecision } from "../chat.types";
import type { ConversationMode } from "../chat-mode/conversation-mode.types";
import {
    EMPTY_LLM_SEARCH_FILTERS,
    LLM_DECISION_PARSE_FALLBACK_REPLY,
    LLM_JOB_AWARE_PARSE_FALLBACK_REPLY,
    LLM_STAGE_PARSE_FALLBACK_REPLY,
} from "./chat.llm.consts";
import { parseLlmDecisionFromJson, parseStageLlmDecisionFromJson } from "./chat.llm.utils";
import { buildDreamJobPrompt } from "../dream-job/chat.dream-job.prompt.utils";
import {
    DREAM_JOB_LLM_PARSE_FALLBACK_REPLY,
    parseDreamJobLlmDecisionFromJson,
} from "../dream-job/chat.dream-job.llm.utils";
import type { DreamJobLlmDecision } from "../dream-job/chat.dream-job.types";
import type { DreamJobFlow } from "../../conversation/conversation.model";
import { buildDecisionPrompt, buildRecommendationPrompt, buildStagePrompt } from "./chat.prompt.utils";
import type { ChatLlmObservedOperation, ChatLlmObserver } from "./chat.llm.types";

export class ChatLlmService {
    constructor(
        private readonly textCompletion: TextCompletionPort,
        private readonly observer?: ChatLlmObserver
    ) { }

    private recordParseEvent = (operation: ChatLlmObservedOperation, rawText: string, parseStatus: "success" | "fallback"): void => {
        this.observer?.recordParseEvent({ operation, rawText, parseStatus });
    };

    decideNextStep = async (
        conversation: Conversation,
        latestUserMessage: string,
        userAchievements: readonly UserAchievement[],
        mode: ConversationMode = "GUIDED",
        userAccountContext?: string
    ): Promise<LlmDecision> => {
        const rawText = await this.textCompletion.complete(
            buildDecisionPrompt(conversation, latestUserMessage, userAchievements, mode, userAccountContext),
            { operation: "chat.decision", userId: conversation.userId }
        );

        try {
            const parsed = parseLlmDecisionFromJson(rawText);
            this.recordParseEvent("chat.decision", rawText, "success");
            return parsed;
        } catch {
            this.recordParseEvent("chat.decision", rawText, "fallback");
            return {
                reply: LLM_DECISION_PARSE_FALLBACK_REPLY,
                shouldSearchJobs: false,
                recommendedJobIds: [],
                searchFilters: EMPTY_LLM_SEARCH_FILTERS,
            };
        }
    };

    generateJobAwareReply = async (
        conversation: Conversation,
        latestUserMessage: string,
        jobs: readonly JobSearchResultItem[],
        userAchievements: readonly UserAchievement[],
        userAccountContext?: string
    ): Promise<LlmDecision> => {
        const rawText = await this.textCompletion.complete(
            buildRecommendationPrompt(conversation, latestUserMessage, jobs, userAchievements, userAccountContext),
            { operation: "chat.job_aware_reply", userId: conversation.userId }
        );

        try {
            const parsed = parseLlmDecisionFromJson(rawText);
            this.recordParseEvent("chat.job_aware_reply", rawText, "success");
            return parsed;
        } catch {
            this.recordParseEvent("chat.job_aware_reply", rawText, "fallback");
            return {
                reply: LLM_JOB_AWARE_PARSE_FALLBACK_REPLY,
                shouldSearchJobs: false,
                recommendedJobIds: jobs.map((job) => job.id),
                searchFilters: EMPTY_LLM_SEARCH_FILTERS,
            };
        }
    };

    decideDreamJobStep = async (
        conversation: Conversation,
        latestUserMessage: string,
        userAccountContext: string,
        dreamJobFlow: DreamJobFlow | undefined
    ): Promise<DreamJobLlmDecision> => {
        const rawText = await this.textCompletion.complete(
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

    generateStageReply = async (
        conversation: Conversation,
        latestUserMessage: string,
        stage: ConversationStage,
        userAchievements: readonly UserAchievement[],
        mode: ConversationMode = "GUIDED",
        userAccountContext?: string
    ): Promise<StageLlmDecision> => {
        const rawText = await this.textCompletion.complete(
            buildStagePrompt(conversation, latestUserMessage, stage, userAchievements, mode, userAccountContext),
            { operation: "chat.stage_reply", userId: conversation.userId }
        );
        try {
            const parsed = parseStageLlmDecisionFromJson(rawText);
            this.recordParseEvent("chat.stage_reply", rawText, "success");
            return parsed;
        } catch {
            this.recordParseEvent("chat.stage_reply", rawText, "fallback");
            return {
                reply: LLM_STAGE_PARSE_FALLBACK_REPLY,
                shouldAdvanceStage: false,
            };
        }
    };
}
