import type { UserAchievement } from "../../api/shared/chat.model";
import type { JobSearchResultItem } from "../../api/shared/chat.types";
import type { Conversation } from "../../../routes/conversation/conversation.model";
import type { TextCompletionRequest } from "../../../litellm/text-completion/text-completion.types";

const MAX_ACCOUNT_CONTEXT_CHARS = 1_200;
const MAX_HISTORY_MESSAGES = 4;
const MAX_HISTORY_MESSAGE_CHARS = 400;
const MAX_JOB_DESCRIPTION_CHARS = 300;
const MAX_JOBS = 8;

const buildRecentHistory = (conversation: Conversation): string =>
    conversation.messages
        .slice(-MAX_HISTORY_MESSAGES)
        .map((message) => `${message.role.toUpperCase()}: ${message.content.slice(0, MAX_HISTORY_MESSAGE_CHARS)}`)
        .join("\n");

const buildAchievements = (achievements: readonly UserAchievement[]): string =>
    achievements.slice(0, 5).map((achievement) => achievement.name).join("; ") || "none";

const buildJobs = (jobs: readonly JobSearchResultItem[]): string =>
    jobs
        .slice(0, MAX_JOBS)
        .map((job) => JSON.stringify({
            id: job.id,
            title: job.title,
            company: job.company,
            salary: job.salary ?? null,
            seniority: job.seniority,
            description: job.description.slice(0, MAX_JOB_DESCRIPTION_CHARS),
        }))
        .join("\n");

export const buildRecommendationPrompt = (
    conversation: Conversation,
    latestUserMessage: string,
    jobs: readonly JobSearchResultItem[],
    userAchievements: readonly UserAchievement[],
    userAccountContext: string = "No structured account context is available."
): TextCompletionRequest => ({
    systemPrompt: `You are a concise career coach. Return ONLY compact JSON, no markdown:
{"r":"one short recommendation ending with a pipeline question","ids":["exact job id"]}

Recommend only listed jobs and copy ids exactly. Never show ids to the user or invent job facts.
Prefer one best match unless multiple were requested. Briefly explain the fit, then ask whether to add it to the interview-tracking pipeline.
Use the user's language. Keep r to at most two short sentences. Never expose internal scores.`,
    userPrompt: `Jobs:
${buildJobs(jobs)}
Achievements: ${buildAchievements(userAchievements)}
Account:
${userAccountContext.slice(0, MAX_ACCOUNT_CONTEXT_CHARS)}
Recent conversation:
${buildRecentHistory(conversation)}
Latest: ${latestUserMessage}
`,
    responseFormat: "json",
});
