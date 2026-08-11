import type { Conversation, OnboardingFlow } from "../../../routes/conversation/conversation.model";
import {
    extractChatStatedBackgroundFacts,
    formatChatStatedFactsForPrompt,
} from "./onboarding.chat-facts.utils";

const MAX_ACCOUNT_CONTEXT_CHARS = 2_000;
const MAX_HISTORY_MESSAGES = 6;
const MAX_HISTORY_MESSAGE_CHARS = 400;

const buildRecentHistory = (conversation: Conversation, latestUserMessage: string): string => {
    const lastMessage = conversation.messages.at(-1);
    const historyMessages = lastMessage?.role === "user" && lastMessage.content === latestUserMessage
        ? conversation.messages.slice(0, -1)
        : conversation.messages;

    return historyMessages
        .slice(-MAX_HISTORY_MESSAGES)
        .map((message) => `${message.role.toUpperCase()}: ${message.content.slice(0, MAX_HISTORY_MESSAGE_CHARS)}`)
        .join("\n");
};

export const buildOnboardingPrompt = (
    conversation: Conversation,
    latestUserMessage: string,
    userAccountContext: string,
    onboardingFlow: OnboardingFlow,
): string => {
    const chatFacts = extractChatStatedBackgroundFacts(latestUserMessage);
    const chatFactsLine = formatChatStatedFactsForPrompt(chatFacts);

    return `
You are the onboarding layer of a career coach. Return ONLY compact JSON (no markdown):
{"response":"message to user","background":{"status":"FOUND|NONE|UNKNOWN","role":null,"yearsOfExperience":null,"companies":[],"technologies":[],"education":[],"summary":null},"mode":null,"advance":false,"onboarding":{"backgroundResolved":false,"backgroundAskCount":0,"directionResolved":false,"directionAskCount":0,"completed":false}}

Rules:
- Do not invent professional history. Only use the latest user message and Account context when facts are explicitly present.
- CHAT_STATED_FACTS are authoritative for role and yearsOfExperience whenever present. background.role, background.yearsOfExperience, background.summary, and the spoken response MUST use those chat values.
- Account/CV is secondary enrichment only: fill companies, technologies, education, or specialty details the user did not state. Never replace chat-stated role wording or years with a CV title/tenure variant.
- If chat says "qa" / "5 years" and CV says "QA Automation & Performance Engineer" / "2 years", use chat role wording and chat years; you may add a non-conflicting company from CV after that.
- Never mention missing LinkedIn/GitHub/CV. Omit unavailable sources entirely.
- Never expose mode names, counters, brackets, or internal routing to the user. Forbidden in response: NEAR_TERM, DREAMJOB, GUIDED, FOUND, NONE, UNKNOWN, or patterns like [NEAR_TERM|DREAMJOB|GUIDED].
- Keep responses concise, natural, and readable — like a human coach, not a form.
- Do NOT repeat the same background paragraph on later turns. After background is resolved, response must be a short question or short acknowledgement only.

CHAT_STATED_FACTS (authoritative for role/years): ${chatFactsLine}

Current onboarding state (authoritative for what to do next):
backgroundResolved=${onboardingFlow.backgroundResolved}
backgroundAskCount=${onboardingFlow.backgroundAskCount}
directionResolved=${onboardingFlow.directionResolved}
directionAskCount=${onboardingFlow.directionAskCount}
completed=${onboardingFlow.completed}
storedBackground=${JSON.stringify(onboardingFlow.background ?? null)}

If backgroundResolved is false:
- Classify background.status as FOUND (usable role/experience/education/projects), NONE (explicitly no experience / first job), or UNKNOWN (hi / unrelated / no usable info).
- FOUND: set advance=true, fill background fields from evidence (chat facts first), and set response to ONE short personalized summary PLUS a natural career-direction question.
  Good example: "Nice — QA for about 5 years at IDF. Are you looking for a job now, aiming for a longer-term role in the future, or still figuring out what you want?"
  Bad example: repeating a CV title/years the user did not claim, or "You're now looking to [NEAR_TERM|DREAMJOB|GUIDED]."
- NONE: set advance=true, background reflects no experience, and ask the same kind of natural direction question (do not re-ask for background).
- UNKNOWN: set advance=false and ask once for work experience, studies, projects, or technical background.

If backgroundResolved is true and directionResolved is false:
- Keep the stored background fields in JSON. Do NOT restate the full background in response.
- Set mode in the JSON only (NEAR_TERM, DREAMJOB, or GUIDED) from the latest message, or null if unclear.
- Treat as NEAR_TERM when the user wants something soon: "looking for something now", "job now", "soon", bare "now", "next few months", stay in current field and find work now.
- Treat as DREAMJOB for longer-term / future / dream titles.
- Treat as GUIDED for unsure / help me figure it out.
- If mode is set: advance=true, and response is a short plain acknowledgement only (no biography repeat).
- If mode is null: advance=false and response MUST be only: "Are you looking for a job now, aiming for a longer-term role in the future, or still figuring out what you want?"

Account:
${userAccountContext.slice(0, MAX_ACCOUNT_CONTEXT_CHARS)}
Recent conversation:
${buildRecentHistory(conversation, latestUserMessage)}
Latest: ${latestUserMessage}
`;
};
