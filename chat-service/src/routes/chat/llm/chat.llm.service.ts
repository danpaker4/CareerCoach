import type { TextCompletionPort } from "../../../ai/ports/text-completion.types";
import type { Conversation } from "../conversation/conversation.model";
import type { ConversationStage } from "../conversation/conversation.stage.consts";
import type { JobSearchResultItem, LlmDecision, StageLlmDecision } from "../chat.types";
import type { ConversationMode } from "../coach/conversation-mode.types";
import type { ConversationMemory } from "../memory/conversation-memory.types";
import {
    EMPTY_LLM_SEARCH_FILTERS,
    LLM_DECISION_PARSE_FALLBACK_REPLY,
    LLM_JOB_AWARE_PARSE_FALLBACK_REPLY,
    LLM_STAGE_PARSE_FALLBACK_REPLY,
} from "./chat.llm.consts";
import { parseLlmDecisionFromJson, parseStageLlmDecisionFromJson } from "./chat.llm.utils";
import { buildDecisionPrompt, buildRecommendationPrompt, buildStagePrompt } from "./chat.prompt.utils";

export class ChatLlmService {
    constructor(private readonly textCompletion: TextCompletionPort) { }

    decideNextStep = async (
        conversation: Conversation,
        latestUserMessage: string,
        memories: readonly ConversationMemory[] = [],
        mode: ConversationMode = "GUIDED",
        userAccountContext?: string
    ): Promise<LlmDecision> => {
        const rawText = await this.textCompletion.complete(
            buildDecisionPrompt(conversation, latestUserMessage, memories, mode, userAccountContext)
        );

        try {
            return parseLlmDecisionFromJson(rawText);
        } catch {
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
        memories: readonly ConversationMemory[] = [],
        userAccountContext?: string
    ): Promise<LlmDecision> => {
        const rawText = await this.textCompletion.complete(
            buildRecommendationPrompt(conversation, latestUserMessage, jobs, memories, userAccountContext)
        );

        try {
            return parseLlmDecisionFromJson(rawText);
        } catch {
            return {
                reply: LLM_JOB_AWARE_PARSE_FALLBACK_REPLY,
                shouldSearchJobs: false,
                recommendedJobIds: jobs.map((job) => job.jobId),
                searchFilters: EMPTY_LLM_SEARCH_FILTERS,
            };
        }
    };

    generateStageReply = async (
        conversation: Conversation,
        latestUserMessage: string,
        stage: ConversationStage,
        mode: ConversationMode = "GUIDED",
        userAccountContext?: string
    ): Promise<StageLlmDecision> => {
        const rawText = await this.textCompletion.complete(buildStagePrompt(conversation, latestUserMessage, stage, mode, userAccountContext));
        try {
            return parseStageLlmDecisionFromJson(rawText);
        } catch {
            return {
                reply: LLM_STAGE_PARSE_FALLBACK_REPLY,
                shouldAdvanceStage: false,
            };
        }
    };
}
