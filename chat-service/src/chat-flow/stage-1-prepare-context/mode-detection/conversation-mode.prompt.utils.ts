import type { Conversation } from "../../../routes/conversation/conversation.model";
import { CONVERSATION_MODE_OPTIONS } from "./conversation-mode.consts";

const DEFAULT_USER_ACCOUNT_CONTEXT =
    "No structured account context is available yet (no CV excerpt, GitHub skills, or profile lists were provided for this turn).";

const buildHistory = (conversation: Conversation): string =>
    conversation.messages.map((message) => `${message.role.toUpperCase()}: ${message.content}`).join("\n");

export const buildConversationModeDetectionPrompt = (
    conversation: Conversation,
    latestUserMessage: string,
    userAccountContext: string = DEFAULT_USER_ACCOUNT_CONTEXT
): string => `
You are CareerCoach AI's conversation mode detector.
Analyze the WHOLE conversation (not only the latest message) and decide which mode the conversation is in now.

Respond ONLY with valid JSON in this exact structure:
{
  "mode": "DREAMJOB" | "NEAR_TERM" | "GUIDED",
  "readinessScore": 0,
  "isReady": false,
  "missingInformation": ["string"],
  "dreamJobTitle": "string or null",
  "searchQuery": "string or null"
}

Available modes:
${JSON.stringify(CONVERSATION_MODE_OPTIONS, null, 2)}

Mode rules:
- DREAMJOB: the user talks about their dreams, working in the future, or long-term goals (not the near time).
- NEAR_TERM: the user wants a job in the near time — the next job, or within the next few months up to a year.
- GUIDED: the user has not shown yet which of the two they want. Stay here until there is enough information to decide.
- If the user pivots (e.g. from dream talk to "I need a job now"), follow the LATEST clear intent.

Readiness rules (for the selected mode only):
- readinessScore is 0-100: how much of the required information is already collected.
- DREAMJOB is ready when a concrete dream job title can be extracted from the conversation. When ready set isReady=true and dreamJobTitle to one short professional title (e.g. "Founder", "Data Engineer"). Otherwise dreamJobTitle=null.
- NEAR_TERM is ready when the target role or domain for the near time is clear enough to search jobs. When ready set isReady=true and searchQuery to the job title or domain to search (e.g. "data engineer"). Otherwise searchQuery=null.
- GUIDED is ready when enough information exists to decide between DREAMJOB and NEAR_TERM (then pick that mode instead on the next turns). isReady for GUIDED means the decision can be made.
- missingInformation: short concrete items still needed for the selected mode (e.g. "target role for the near time", "current skills", "timeline: near time or future dream"). Empty array when nothing is missing.

Known account context (registration profile, CV excerpt, GitHub skills):
${userAccountContext}

Conversation so far:
${buildHistory(conversation)}

Latest user message:
${latestUserMessage}
`;
