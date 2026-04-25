import type { Conversation } from "../conversation/conversation.model";
import type { JobSearchResultItem } from "../chat.types";

const buildHistory = (conversation: Conversation): string =>
    conversation.messages
        .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
        .join("\n");

const achievementsText = (conversation: Conversation): string =>
    conversation.achievements.length === 0
        ? "No achievements available yet."
        : conversation.achievements.map((achievement) => `- ${achievement.name}`).join("\n");

export const buildDecisionPrompt = (conversation: Conversation, latestUserMessage: string): string => `
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
- Never disclose internal achievement scores/grades to the user.

User achievements:
${achievementsText(conversation)}

Conversation so far:
${buildHistory(conversation)}

Latest user message:
${latestUserMessage}
`;

export const buildRecommendationPrompt = (
    conversation: Conversation,
    latestUserMessage: string,
    jobs: readonly JobSearchResultItem[]
): string => `
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
- Never disclose internal achievement scores/grades to the user.

User achievements:
${achievementsText(conversation)}

Conversation so far:
${buildHistory(conversation)}

Latest user message:
${latestUserMessage}
`;
