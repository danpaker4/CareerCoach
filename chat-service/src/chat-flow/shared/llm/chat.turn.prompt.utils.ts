import type { UserAchievement } from "../../api/shared/chat.model";
import type { Conversation } from "../../../routes/conversation/conversation.model";
import type { ConversationStage } from "../../../routes/conversation/conversation.types";
import type { TextCompletionRequest } from "../../../litellm/text-completion/text-completion.types";

const MAX_ACCOUNT_CONTEXT_CHARS = 1_600;
const MAX_HISTORY_MESSAGES = 6;
const MAX_HISTORY_MESSAGE_CHARS = 500;
const MAX_ACHIEVEMENTS = 5;

const buildRecentHistory = (conversation: Conversation, latestUserMessage: string): string => {
    const lastMessage = conversation.messages.at(-1);
    const historyMessages = lastMessage?.role === "user" && lastMessage.content === latestUserMessage
        ? conversation.messages.slice(0, -1)
        : conversation.messages;

    return historyMessages
        .slice(-MAX_HISTORY_MESSAGES)
        .map((message) => {
            const content = message.content.slice(0, MAX_HISTORY_MESSAGE_CHARS);
            const attachedJobs = message.attachedJobs?.map((job) => ({
                title: job.jobTitle,
                company: job.company,
                salary: job.salary,
                seniority: job.seniority,
            }));
            const jobContext = attachedJobs && attachedJobs.length > 0
                ? ` JOBS:${JSON.stringify(attachedJobs)}`
                : "";
            return `${message.role.toUpperCase()}: ${content}${jobContext}`;
        })
        .join("\n");
};

const buildAchievements = (achievements: readonly UserAchievement[]): string =>
    achievements.length === 0
        ? "none"
        : achievements.slice(0, MAX_ACHIEVEMENTS).map((achievement) => achievement.name).join("; ");

export const buildTurnDecisionPrompt = (
    conversation: Conversation,
    latestUserMessage: string,
    userAchievements: readonly UserAchievement[],
    userAccountContext: string,
    currentStage?: ConversationStage | null
): TextCompletionRequest => ({
    systemPrompt: `You are a concise career coach. Return ONLY compact JSON, no markdown:
{"r":"one short reply","m":"G","ready":false,"target":null,"advance":false,"search":false,"skills":[],"interests":[],"level":"","keywords":[]}

m: G=guided/unclear, N=next job within about a year, D=long-term dream. Follow the latest clear pivot.
For N/D, ready=true only when target is a useful job/domain or dream title. For G, target=null.
search=true for direct job/domain requests, ready N turns, or enough clear/discovery signals to find relevant jobs.
When search=true, fill skills, interests, level, keywords from known facts. Never ask the user to choose a path.
Guided objective: "${currentStage?.objective ?? "No guided stage remains."}"
advance=true only when the conversation satisfies that objective; otherwise ask one high-impact question.
r must use the user's language and be one short sentence or question. Use known context without asking for repetition.
Never expose internal scores/IDs, ask workplace-location preferences, or invent job facts. Use JOBS only for company/salary facts.
`,
    userPrompt: `Achievements: ${buildAchievements(userAchievements)}
Account:
${userAccountContext.slice(0, MAX_ACCOUNT_CONTEXT_CHARS)}
Recent conversation:
${buildRecentHistory(conversation, latestUserMessage)}
Latest: ${latestUserMessage}
`,
    responseFormat: "json",
});
