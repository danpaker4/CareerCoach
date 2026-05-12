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
import { extractJsonObjectFromModelText } from "../dream-job/dream-job.llm.utils";
import {
    buildFuturePlanningClosingPrompt,
    buildFuturePlanningReplyPrompt,
    type FuturePlanningClosingParams,
    type FuturePlanningUserSnapshot,
} from "./chat.future-planning.prompt.utils";
import { buildDecisionPrompt, buildRecommendationPrompt, buildStagePrompt } from "./chat.prompt.utils";
import type { UserCareerProfile } from "../career-profile/career-profile.types";

export class ChatLlmService {
    constructor(private readonly textCompletion: TextCompletionPort) { }

    decideNextStep = async (
        conversation: Conversation,
        latestUserMessage: string,
        memories: readonly ConversationMemory[] = [],
        mode: ConversationMode = "GUIDED"
    ): Promise<LlmDecision> => {
        const rawText = await this.textCompletion.complete(buildDecisionPrompt(conversation, latestUserMessage, memories, mode));

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
        memories: readonly ConversationMemory[] = []
    ): Promise<LlmDecision> => {
        const rawText = await this.textCompletion.complete(
            buildRecommendationPrompt(conversation, latestUserMessage, jobs, memories)
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
        mode: ConversationMode = "GUIDED"
    ): Promise<StageLlmDecision> => {
        const rawText = await this.textCompletion.complete(buildStagePrompt(conversation, latestUserMessage, stage, mode));
        try {
            return parseStageLlmDecisionFromJson(rawText);
        } catch {
            return {
                reply: LLM_STAGE_PARSE_FALLBACK_REPLY,
                shouldAdvanceStage: false,
            };
        }
    };

    generateFuturePlanningReply = async (
        conversation: Conversation,
        latestUserMessage: string,
        memories: readonly ConversationMemory[],
        profile: UserCareerProfile,
        userFutureSnapshot: FuturePlanningUserSnapshot
    ): Promise<{ reply: string }> => {
        const rawText = await this.textCompletion.complete(
            buildFuturePlanningReplyPrompt(conversation, latestUserMessage, memories, profile, userFutureSnapshot)
        );
        try {
            const parsed: unknown = JSON.parse(extractJsonObjectFromModelText(rawText));
            if (typeof parsed !== "object" || parsed === null) {
                throw new Error("invalid");
            }
            const reply = (parsed as Record<string, unknown>).reply;
            if (typeof reply !== "string" || reply.trim().length === 0) {
                throw new Error("invalid reply");
            }
            return { reply: reply.trim() };
        } catch {
            return {
                reply: "Looking ahead a few years, do you already picture a specific kind of role—like leading a team, owning a product area, going deep as a specialist, or starting something of your own—or are you still weighing a few directions?",
            };
        }
    };

    generateFuturePlanningClosingReply = async (params: FuturePlanningClosingParams): Promise<{ reply: string }> => {
        const rawText = await this.textCompletion.complete(buildFuturePlanningClosingPrompt(params));
        try {
            const parsed: unknown = JSON.parse(extractJsonObjectFromModelText(rawText));
            if (typeof parsed !== "object" || parsed === null) {
                throw new Error("invalid");
            }
            const reply = (parsed as Record<string, unknown>).reply;
            if (typeof reply !== "string" || reply.trim().length === 0) {
                throw new Error("invalid reply");
            }
            return { reply: reply.trim() };
        } catch {
            const label = params.normalizedDreamJob.trim();
            if (params.persistedToProfile) {
                return {
                    reply: `That makes sense. Moving toward ${label} is a clear direction. I saved this as your current long-term goal, and we can refine it later whenever you want.`,
                };
            }
            if (params.profileUpdateFailed) {
                return {
                    reply: `I heard you on ${label}. I could not update your saved profile just now—try refreshing the app or signing in again, then tell me once more if you want it saved. We can keep working from what you shared either way.`,
                };
            }
            return {
                reply: `That makes sense—${label} is a strong direction to aim for. If something else is already saved on your profile with higher confidence, we kept that for now; say the word any time you want to update it.`,
            };
        }
    };
}
