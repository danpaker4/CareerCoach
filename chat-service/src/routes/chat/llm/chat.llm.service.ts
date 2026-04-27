import { GoogleGenerativeAI } from "@google/generative-ai";
import type { Conversation } from "../conversation/conversation.model";
import type { ConversationStage } from "../conversation/conversation.stage.consts";
import type { JobSearchResultItem, LlmDecision, StageLlmDecision } from "../chat.types";
import { buildDecisionPrompt, buildRecommendationPrompt, buildStagePrompt } from "./chat.prompt.builder";

const EMPTY_FILTERS = {
    skills: [],
    interests: [],
    experienceLevel: "",
    keywords: [],
};

const parseDecision = (rawText: string): LlmDecision => {
    const parsed: unknown = JSON.parse(rawText);
    if (typeof parsed !== "object" || parsed === null) {
        throw new Error("LLM returned non-object decision payload");
    }

    const obj = parsed as Record<string, unknown>;
    return {
        reply: typeof obj.reply === "string" ? obj.reply : "I need a bit more information to guide you.",
        shouldSearchJobs: obj.shouldSearchJobs === true,
        recommendedJobIds: Array.isArray(obj.recommendedJobIds)
            ? obj.recommendedJobIds.filter((jobId): jobId is string => typeof jobId === "string")
            : [],
        searchFilters: {
            skills: Array.isArray(obj.searchFilters) ? [] : Array.isArray((obj.searchFilters as Record<string, unknown>)?.skills)
                ? ((obj.searchFilters as Record<string, unknown>).skills as unknown[]).filter((value): value is string => typeof value === "string")
                : [],
            interests: Array.isArray(obj.searchFilters) ? [] : Array.isArray((obj.searchFilters as Record<string, unknown>)?.interests)
                ? ((obj.searchFilters as Record<string, unknown>).interests as unknown[]).filter((value): value is string => typeof value === "string")
                : [],
            experienceLevel: Array.isArray(obj.searchFilters) ? "" : typeof (obj.searchFilters as Record<string, unknown>)?.experienceLevel === "string"
                ? (obj.searchFilters as Record<string, unknown>).experienceLevel as string
                : "",
            keywords: Array.isArray(obj.searchFilters) ? [] : Array.isArray((obj.searchFilters as Record<string, unknown>)?.keywords)
                ? ((obj.searchFilters as Record<string, unknown>).keywords as unknown[]).filter((value): value is string => typeof value === "string")
                : [],
        },
    };
};

const parseStageDecision = (rawText: string): StageLlmDecision => {
    const parsed: unknown = JSON.parse(rawText);
    if (typeof parsed !== "object" || parsed === null) {
        throw new Error("LLM returned non-object stage payload");
    }

    const obj = parsed as Record<string, unknown>;
    return {
        reply: typeof obj.reply === "string" ? obj.reply : "Thanks. Tell me a bit more so I can guide you accurately.",
        shouldAdvanceStage: obj.shouldAdvanceStage === true,
    };
};

export class ChatLlmService {
    private readonly model;

    constructor(geminiApiKey: string) {
        const genAI = new GoogleGenerativeAI(geminiApiKey);
        this.model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
    }

    decideNextStep = async (conversation: Conversation, latestUserMessage: string): Promise<LlmDecision> => {
        const result = await this.model.generateContent(buildDecisionPrompt(conversation, latestUserMessage));
        const rawText = result.response.text();

        try {
            return parseDecision(rawText);
        } catch {
            return {
                reply: "Thanks, that helps. Could you share the type of role and tech stack you enjoy most?",
                shouldSearchJobs: false,
                recommendedJobIds: [],
                searchFilters: EMPTY_FILTERS,
            };
        }
    };

    generateJobAwareReply = async (conversation: Conversation, latestUserMessage: string, jobs: readonly JobSearchResultItem[]): Promise<LlmDecision> => {
        const result = await this.model.generateContent(buildRecommendationPrompt(conversation, latestUserMessage, jobs));
        const rawText = result.response.text();

        try {
            return parseDecision(rawText);
        } catch {
            return {
                reply: "I found relevant jobs. Tell me which one sounds closest to your goals, and I will help you refine it.",
                shouldSearchJobs: false,
                recommendedJobIds: jobs.map((job) => job.jobId),
                searchFilters: EMPTY_FILTERS,
            };
        }
    };

    generateStageReply = async (
        conversation: Conversation,
        latestUserMessage: string,
        stage: ConversationStage
    ): Promise<StageLlmDecision> => {
        const result = await this.model.generateContent(buildStagePrompt(conversation, latestUserMessage, stage));
        const rawText = result.response.text();
        try {
            return parseStageDecision(rawText);
        } catch {
            return {
                reply: "Got it. Can you share a bit more detail so I can guide you better?",
                shouldAdvanceStage: false,
            };
        }
    };
}
