import { GoogleGenerativeAI } from "@google/generative-ai";
import type { Conversation } from "./chat.model";
import type { JobSearchResultItem, LlmDecision } from "./chat.types";

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

const buildHistory = (conversation: Conversation): string =>
    conversation.messages
        .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
        .join("\n");

const achievementsText = (conversation: Conversation): string =>
    conversation.achievements.length === 0
        ? "No achievements available yet."
        : conversation.achievements.map((achievement) => `- ${achievement.name} (grade: ${achievement.grade})`).join("\n");

const buildDecisionPrompt = (conversation: Conversation, latestUserMessage: string): string => `
You are CareerCoach AI.
Respond ONLY with valid JSON in this exact structure:
{
  "reply": "string",
  "shouldSearchJobs": boolean,
  "recommendedJobIds": ["string"],
  "searchFilters": {
    "skills": ["string"],
    "interests": ["string"],
    "experienceLevel": "string",
    "keywords": ["string"]
  }
}

Rules:
- Keep conversation continuous.
- Do NOT restart conversation if there is existing history.
- Only trigger shouldSearchJobs=true when enough details exist.
- If there are no jobs in context yet, recommendedJobIds must be [].
- Do not mention salary, company details, or requirements unless explicitly provided in supplied jobs context.

User achievements:
${achievementsText(conversation)}

Conversation so far:
${buildHistory(conversation)}

Latest user message:
${latestUserMessage}
`;

const buildRecommendationPrompt = (conversation: Conversation, latestUserMessage: string, jobs: readonly JobSearchResultItem[]): string => `
You are CareerCoach AI.
Respond ONLY with valid JSON in this exact structure:
{
  "reply": "string",
  "shouldSearchJobs": false,
  "recommendedJobIds": ["string"],
  "searchFilters": {
    "skills": [],
    "interests": [],
    "experienceLevel": "",
    "keywords": []
  }
}

You can recommend ONLY from these jobs:
${jobs.map((job) => `- jobId: ${job.jobId}, title: ${job.jobTitle}, seniority: ${job.seniority}, description: ${job.description}`).join("\n")}

Strict rules:
- Every recommendedJobIds value must match a listed jobId.
- Mention jobId in reply when recommending jobs.
- Never invent salary, company details, or extra requirements.

User achievements:
${achievementsText(conversation)}

Conversation so far:
${buildHistory(conversation)}

Latest user message:
${latestUserMessage}
`;

export class ChatLlmService {
    private readonly model;

    constructor(geminiApiKey: string) {
        const genAI = new GoogleGenerativeAI(geminiApiKey);
        this.model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite-preview" });
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
}
