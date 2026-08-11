import type { UserAchievement } from "../../api/shared/chat.model";
import type { Conversation } from "../../../routes/conversation/conversation.model";
import type { ConversationStage } from "../../../routes/conversation/conversation.types";

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

const buildResolvedBackground = (conversation: Conversation): string => {
    const background = conversation.onboardingFlow?.background;
    if (!background) {
        return "none";
    }
    return JSON.stringify({
        role: background.role ?? null,
        yearsOfExperience: background.yearsOfExperience ?? null,
    });
};

export const buildTurnDecisionPrompt = (
    conversation: Conversation,
    latestUserMessage: string,
    userAchievements: readonly UserAchievement[],
    userAccountContext: string,
    currentStage?: ConversationStage | null
): string => `
You are a concise career coach. Return ONLY compact JSON, no markdown:
{"r":"one short reply","m":"G","ready":false,"target":null,"advance":false,"search":false,"skills":[],"interests":[],"level":"","keywords":[]}

m: G=guided/unclear, N=next job within about a year, D=long-term dream. Follow the latest clear pivot.
If the latest message clearly wants a job/role now or soon (e.g. "I'm looking for a job now as a software developer"), set m=N, ready=true, search=true, and target to that role. Do NOT dig into likes or push dream-job questions.
If the latest message clearly prefers dream job / long-term / future goals (e.g. "I prefer to talk about my dream job", "I'm thinking about the future"), set m=D and do NOT dig into likes or ask about their current CV role.
If the latest message is undecided (e.g. "I don't know", "not sure", vague non-decisive interest), keep m=G, advance into discovery, and only then ask about past work / what they enjoy.
For N/D, ready=true only when target is a useful job/domain or dream title. For G, target=null.
search=true for direct job/domain requests, ready N turns, or enough clear/discovery signals to find relevant jobs.
When the user is choosing, adding, rejecting, or clarifying among jobs already listed in the conversation (e.g. "add the Check Point role", "the second one", "none of these"), set search=false — do not start a new job search.
When search=true, fill skills, interests, level, keywords from known facts. Never ask the user to choose a path.
Guided objective: "${currentStage?.objective ?? "No guided stage remains."}"
Initial background and career-direction onboarding already ran for this conversation. Do not re-ask for professional background or the near-term vs dream vs unsure fork.
For GUIDED discovery, ask about what they enjoy, constraints, or skills to grow — not why they like work in a therapy style, and not the original onboarding questions.
Never ask "why do you like X", "what's driving your interest", or "explore what you enjoy" after a decisive now/future answer.
advance=true when the conversation satisfies that objective; otherwise ask one high-impact question that matches the objective.
r must use the user's language and be one short sentence or question. Use known context without asking for repetition.
User chat is the source of truth. If a latest explicit user statement conflicts with Account/profile/CV/skills, use only the latest chat value for that fact. Do not mention the conflicting stored value and do not ask the user to choose between sources.
Never expose internal scores/IDs, ask workplace-location preferences, or invent job facts. Use JOBS only for company/salary facts.

Achievements: ${buildAchievements(userAchievements)}
Resolved conversation background (authoritative over conflicting Account/CV values):
${buildResolvedBackground(conversation)}
Account:
${userAccountContext.slice(0, MAX_ACCOUNT_CONTEXT_CHARS)}
Recent conversation:
${buildRecentHistory(conversation, latestUserMessage)}
Latest: ${latestUserMessage}
`;
