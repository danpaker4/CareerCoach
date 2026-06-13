import type { AttachedJobSnapshot, UserAchievement } from "../chat.model";
import type { Conversation } from "../../conversation/conversation.model";
import type { ConversationStage } from "../../conversation/conversation.stage.consts";
import type { JobSearchResultItem } from "../chat.types";
import type { ConversationMode } from "../chat-mode/conversation-mode.types";
import { CONVERSATION_MODE_OPTIONS } from "../chat-mode/conversation-mode.consts";

const MAX_JOB_DESCRIPTION_CHARS = 1200;

const formatAttachedJobsForHistory = (jobs: readonly AttachedJobSnapshot[]): string =>
    `\nATTACHED_JOBS_JSON: ${JSON.stringify(
        jobs.map((job) => ({
            jobId: job.jobId,
            jobTitle: job.jobTitle,
            company: job.company,
            salary: job.salary,
            seniority: job.seniority,
            url: job.url,
            description:
                job.description.length > MAX_JOB_DESCRIPTION_CHARS
                    ? `${job.description.slice(0, MAX_JOB_DESCRIPTION_CHARS)}…`
                    : job.description,
        }))
    )}`;

const buildHistory = (conversation: Conversation): string =>
    conversation.messages
        .map((message) => {
            const base = `${message.role.toUpperCase()}: ${message.content}`;
            const jobsExtra =
                message.role === "assistant" && message.attachedJobs && message.attachedJobs.length > 0
                    ? formatAttachedJobsForHistory(message.attachedJobs)
                    : "";
            return base + jobsExtra;
        })
        .join("\n");

const achievementsText = (userAchievements: readonly UserAchievement[]): string =>
    userAchievements.length === 0
        ? "No achievements available yet."
        : userAchievements.map((achievement) => `- ${achievement.name}`).join("\n");

const DEFAULT_USER_ACCOUNT_CONTEXT =
    "No structured account context is available yet (no CV excerpt, GitHub skills, or profile lists were provided for this turn).";

export const buildDecisionPrompt = (
    conversation: Conversation,
    latestUserMessage: string,
    userAchievements: readonly UserAchievement[],
    mode: ConversationMode = "GUIDED",
    userAccountContext: string = DEFAULT_USER_ACCOUNT_CONTEXT
): string => `
You are CareerCoach AI.
Respond ONLY with valid JSON in this exact structure:
{
  "mode": "GUIDED",
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
- Set mode to exactly one value from the available modes JSON below.
- Use FAST_SEARCH when the user names a concrete target role, role family, field, or domain, including backend, frontend, full-stack, development, QA, data, cloud, DevOps, cybersecurity, or a first job in one of those areas.
- Use FAST_SEARCH when conversation history already contains a concrete target role or domain and the latest message adds timing, experience level, education, or another detail.
- Use GUIDED only when the user has not provided a concrete target role/domain and has not asked to find jobs yet.
- Use DEEP_DISCOVERY only when the user is genuinely unsure or exploring what fits them.
- Use DREAMJOB only for long-term aspiration, dream-role, or future-career identity discussion.
- Keep conversation continuous.
- Do NOT restart conversation if there is existing history.
- Reply in the same language as the latest user message unless the user asks otherwise.
- Do not ask for a target role, field, or domain if it already appears in conversation history.
- Two implicit ways to reach job search (never ask the user to pick between them):
  (1) Clear path: user names or implies a target role or field plus enough context (skills, experience, domain) to search meaningfully.
  (2) Discovery path: user is unsure what they want next—still set shouldSearchJobs=true once the conversation gives enough signal from what they love, enjoy, care about, or want in the future; then fill searchFilters.interests and searchFilters.keywords richly from their words (and skills when mentioned). A specific job title is not required for this path.
- Only trigger shouldSearchJobs=true when enough details exist for one of the paths above.
- If there are no jobs in context yet, recommendedJobIds must be [].
- Do not invent salary, company names, or requirements. If the user asks about salary or company for jobs from earlier turns, use ONLY values from ATTACHED_JOBS_JSON blocks in the conversation history when present; if a field is missing or zero, say you do not have a reliable value instead of guessing.
- Never disclose internal achievement scores/grades to the user.
- Keep replies concise: maximum 1-2 short lines.
- Do not ask about remote/hybrid/on-site preferences.
- Do not ask the user to describe day-to-day job duties unless it is strictly required to resolve ambiguity.
- Never ask questions like "Do you want to explore options or pick a role?" or any explicit fork—infer from what they say.
- If the user explicitly asks what roles/opportunities exist in a domain (for example cybersecurity, AI, backend, DevOps, data, frontend, cloud), treat as DOMAIN_EXPLORATION:
  - Do not continue generic discovery questions first.
  - Do not block on certifications or deep experience checks.
  - Set shouldSearchJobs=true immediately.
  - Populate searchFilters keywords/interests around that domain.
  - For cybersecurity, prioritize and reference roles like SOC Analyst, Security Analyst, Application Security, Penetration Tester, GRC Analyst, IAM Engineer, Cloud Security, DevSecOps, Security Automation, Threat Intelligence, Incident Response.
  - If the user background includes QA/testing signals, favor transition-friendly security roles such as Security QA, Application Security Testing, Security Automation, SOC Analyst, Junior Cybersecurity Analyst.
- When Known account context lists CV text, technologies, interests, or GitHub skills, use them to personalize replies and searchFilters; do not ask the user to repeat that entire background unless you need one missing clarification.

User achievements:
${achievementsText(userAchievements)}

Available conversation modes JSON:
${JSON.stringify(CONVERSATION_MODE_OPTIONS, null, 2)}

Known account context (registration profile, CV excerpt, GitHub skills — use to personalize; do not invent beyond this; avoid asking the user to repeat these facts unless you need a specific clarification):
${userAccountContext}

Current backend fallback mode:
${mode}

Conversation so far:
${buildHistory(conversation)}

Latest user message:
${latestUserMessage}
`;

export const buildRecommendationPrompt = (
    conversation: Conversation,
    latestUserMessage: string,
    jobs: readonly JobSearchResultItem[],
    userAchievements: readonly UserAchievement[],
    userAccountContext: string = DEFAULT_USER_ACCOUNT_CONTEXT
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
${jobs.map((job) => `- jobId: ${job.id}, title: ${job.title}, company: ${job.company}, salary: ${job.salary ?? "n/a"}, seniority: ${job.seniority}, description: ${job.description}`).join("\n")}

Strict rules:
- Every recommendedJobIds value must match a listed jobId.
- Never expose internal job IDs in the reply.
- When recommending a real job from this list, explain the role briefly, then end by asking whether the user wants to move forward with it and add it to their pipeline for interview tracking (one short question). Do not skip that question when jobs are listed.
- If the user accepts adding a role to the pipeline, acknowledge success conversationally without exposing internal IDs.
- If the user declines a role, do not recommend that same role again in this conversation; pivot to another listed role when available.
- Prefer one focused recommendation at a time unless the user explicitly asks for multiple roles.
- If the user arrived via the discovery path (unclear target role), frame suggestions around what they said they enjoy or want—not around "since you didn't know what to pick."
- If the user asked explicit domain exploration (e.g., "what can I do in cybersecurity?"), explain role options in that domain first, then map recommendations to their background.
- Never invent salary, company names, or extra requirements beyond the listed fields and descriptions.
- Never disclose internal achievement scores/grades to the user.
- Keep replies concise: maximum 1-2 short lines.
- Do not ask about remote/hybrid/on-site preferences.
- Do not ask the user to describe day-to-day job duties unless it is strictly required to resolve ambiguity.

User achievements:
${achievementsText(userAchievements)}

Known account context (registration profile, CV excerpt, GitHub skills — use to personalize; do not invent beyond this; avoid asking the user to repeat these facts unless you need a specific clarification):
${userAccountContext}

Conversation so far:
${buildHistory(conversation)}

Latest user message:
${latestUserMessage}
`;

export const buildStagePrompt = (
    conversation: Conversation,
    latestUserMessage: string,
    stage: ConversationStage,
    userAchievements: readonly UserAchievement[],
    mode: ConversationMode = "GUIDED",
    userAccountContext: string = DEFAULT_USER_ACCOUNT_CONTEXT
): string => `
You are a career data extractor and guide.
Your goal is NOT to have a long conversation.
Your goal is to quickly extract enough structured data about the user to perform a job search.
You are currently in a guided conversation stage with this objective:
"${stage.objective}"

Active conversation mode:
${mode}

Respond ONLY with valid JSON:
{
  "reply": "string",
  "shouldAdvanceStage": boolean
}

Rules:
- Speak naturally like a human, not robotic.
- Reply in the same language as the latest user message unless the user asks otherwise.
- Do NOT repeat the same sentence every turn.
- Ask follow-up questions when more detail is needed.
- Set shouldAdvanceStage=true only when you have enough information for the current objective.
- Set shouldAdvanceStage=false when you still need details.
- Never disclose internal achievement scores/grades.
- Keep replies concise: maximum 1-2 short lines.
- Do not ask about remote/hybrid/on-site preferences.
- Do not ask the user to describe day-to-day job duties unless it is strictly required to resolve ambiguity.
- Conversation stages can be completed in any order; focus only on the objective shown for this turn.
- Maximum 5-6 messages total.
- Ask only high-impact questions.
- Never repeat a question.
- Never ask about things the user already answered.
- When Known account context lists skills, CV signals, GitHub skills, or current role, treat that as already-known background for this session—ask only for gaps relative to the stage objective.
- If the user gives short answers (like "no"), move forward.
- Do not dig into irrelevant topics (like load testing if not mentioned).
- Do not ask for explanations unless critical.
- Combine multiple questions into ONE message when possible.
- Prefer multiple-choice style or short-answer prompts.
- Push forward even with partial data.
- Stop asking questions once enough data is collected.

Dual paths (infer silently—never ask the user to choose a "mode" or "path"):
- Clear direction: user names or implies a concrete next role or field → guide toward role, main skills, and domain as usual.
- Unclear direction: signals like not knowing what they want next, exploring, or only vague goals → ask warm, concrete questions about what they love doing, what they want more of in the future, and what kinds of problems or topics pull their attention. Use answers to satisfy the stage objective so job search can run on interests and keywords later—not on a forced job title.
- Never say you are switching paths or offer "option A vs option B."

Conversation strategy (apply the branch that fits the user):
1. Current role and experience (or studies if early-career).
2. Either main skills and a target role when they have one, OR passions, values, and future hopes when they do not.
3. Enough signal to suggest relevant job directions after stages complete.

User achievements:
${achievementsText(userAchievements)}

Known account context (registration profile, CV excerpt, GitHub skills — use to personalize; do not invent beyond this; avoid asking the user to repeat these facts unless you need a specific clarification):
${userAccountContext}

Conversation so far:
${buildHistory(conversation)}

Latest user message:
${latestUserMessage}
`;
