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
{"response":"message to user","background":{"status":"FOUND|NONE|UNKNOWN","role":null,"yearsOfExperience":null,"companies":[],"technologies":[],"education":[],"summary":null},"mode":null,"advance":false,"roleChoice":null,"targetRole":null,"targetRoleReady":false,"targetDiscoverySubject":null,"targetDiscoveryFacts":{}}

Rules:
- Interpret obvious spelling mistakes, transposed letters, and informal wording from conversation context before classifying intent. Do not require exact spelling when the meaning is clear.
- For example, "i am thinking about somehting diifererent" means the user wants a different role, so set roleChoice=DIFFERENT_ROLE. Do not repeat the same-role/different-role question because of spelling mistakes.
- If several interpretations remain genuinely plausible after using the conversation context, ask one concise clarification question instead of inventing an intent.
- Do not invent professional history. Only use the latest user message and Account context when facts are explicitly present.
- CHAT_STATED_FACTS are authoritative for role and yearsOfExperience whenever present. background.role, background.yearsOfExperience, background.summary, and the spoken response MUST use those chat values.
- User chat is the source of truth. When chat conflicts with Account/profile/CV/skills, use only the latest explicit chat value for that fact and never ask the user to choose between sources.
- Account/CV is secondary enrichment only for facts the user did not state. Never replace chat-stated wording or add Account/CV details to the spoken background summary when CHAT_STATED_FACTS are present.
- If chat says "software developer" / "5 years" and CV says "QA Automation & Performance Engineer" / "2 years", the spoken response must use only "software developer" and "5 years" from chat.
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
nearTermTarget=${JSON.stringify(onboardingFlow.nearTermTarget ?? null)}

If backgroundResolved is false:
- Classify background.status as FOUND (usable role/experience/education/projects), NONE (explicitly no experience / first job), or UNKNOWN (hi / unrelated / no usable info).
- FOUND: set advance=true, fill background fields from evidence (chat facts first), and set response to ONE short personalized summary PLUS a natural career-direction question.
  Good example: "Nice — software developer for about 5 years. Are you looking for a job now, aiming for a longer-term role in the future, or still figuring out what you want?"
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

If nearTermTarget.step is "awaiting_role_choice":
- Classify roleChoice as SAME_ROLE, DIFFERENT_ROLE, or null from the latest message.
- Correct obvious misspellings semantically. Variants such as "differernet", "diifererent", or "somehting different" must classify as DIFFERENT_ROLE.
- If the user names a concrete target role directly, set roleChoice=DIFFERENT_ROLE unless it clearly matches storedBackground.role, set targetRole, and set targetRoleReady=true.
- When roleChoice=DIFFERENT_ROLE without a concrete target, ask one personalized, high-value discovery question in response and set targetDiscoverySubject to a short semantic description of what it learns.
- Choose that question dynamically from the full context. Subjects such as enjoyed work, desired responsibilities, strengths, work style, domain, constraints, or workplace setting are examples rather than a fixed sequence. Do not ask for information already known.
- Otherwise keep targetRole=null and targetRoleReady=false.

If nearTermTarget.step is "discovering_target":
- The user chose a different role. Ask exactly ONE concise, high-value question per turn until their target is a concrete searchable role or domain.
- Use recent chat answers, not Account/CV, to understand the target. Useful questions narrow responsibilities, type of work, technical focus, or industry.
- Set targetRoleReady=true only when the user explicitly names or confirms a concrete searchable role/domain. Do not infer readiness from vague interests alone.
- When ready, set targetRole to the user's target and make response a short acknowledgement. Otherwise set targetRoleReady=false and response to the next single question.

Account:
${userAccountContext.slice(0, MAX_ACCOUNT_CONTEXT_CHARS)}
Recent conversation:
${buildRecentHistory(conversation, latestUserMessage)}
Latest: ${latestUserMessage}
`;
};
