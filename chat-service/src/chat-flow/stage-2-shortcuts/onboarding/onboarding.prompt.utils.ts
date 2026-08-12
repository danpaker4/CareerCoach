import type { Conversation, OnboardingFlow } from "../../../routes/conversation/conversation.model";
import type { OnboardingLlmDecision } from "./onboarding.types";
import {
    extractChatStatedBackgroundFacts,
    formatChatStatedFactsForPrompt,
} from "./onboarding.chat-facts.utils";

const MAX_ACCOUNT_CONTEXT_CHARS = 1_200;
const MAX_HISTORY_MESSAGES = 4;
const MAX_HISTORY_MESSAGE_CHARS = 300;

const COMMON_RULES = `
- Interpret obvious spelling mistakes, transposed letters, and informal wording from context.
- If multiple meanings remain plausible, ask one concise clarification question instead of guessing.
- Keep the user-facing response concise and natural.
- Never expose JSON labels or internal routing terms in the user-facing response.`;

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

const buildBackgroundPrompt = (
    latestUserMessage: string,
    userAccountContext: string,
    onboardingFlow: OnboardingFlow,
): string => {
    const chatFacts = extractChatStatedBackgroundFacts(latestUserMessage);
    const chatFactsLine = formatChatStatedFactsForPrompt(chatFacts);
    const hasChatFacts = chatFacts.name !== undefined || chatFacts.role !== undefined || chatFacts.yearsOfExperience !== undefined;
    const accountSection = hasChatFacts || userAccountContext.trim().length === 0
        ? ""
        : `\nSecondary account context (use only explicit facts; never mention missing sources):\n${userAccountContext.slice(0, MAX_ACCOUNT_CONTEXT_CHARS)}\n`;

    return `You classify the user's professional background for a career coach.
Return ONLY compact JSON, no markdown:
{"response":"message","background":{"status":"FOUND|NONE|UNKNOWN","role":null,"yearsOfExperience":null,"companies":[],"technologies":[],"education":[],"summary":null},"mode":null,"advance":false}

Rules:${COMMON_RULES}
- FOUND means the latest message or supplied account context contains usable work, study, project, or technical experience. Set advance=true.
- NONE means the user explicitly has no experience or is seeking a first job. Set advance=true.
- UNKNOWN means there is no usable background. Set advance=false and ask once for relevant background.
- A request for a new job or desired role is career intent, not evidence of the user's current or past professional role.
- Understand role descriptions from the latest message yourself. Do not treat phrases such as looking for, seeking, or wanting a role as current background.
- When FOUND or NONE, respond with one short summary followed by: "Are you looking for a job now, aiming for a longer-term role in the future, or still figuring out what you want?"
- CHAT_STATED_FACTS are authoritative in meaning. Do not replace or contradict the name, role, or years, but correct spelling and rewrite them as natural professional language instead of copying the user's wording.
- Do not invent history or include account/CV details in the response when CHAT_STATED_FACTS are present.
- Always set mode=null. Direction routing is validated separately from the user's explicit wording.

CHAT_STATED_FACTS: ${chatFactsLine}
backgroundAskCount=${onboardingFlow.backgroundAskCount}
${accountSection}Latest user message: ${latestUserMessage}`;
};

export const buildBackgroundReviewPrompt = (
    latestUserMessage: string,
    priorDecision: OnboardingLlmDecision,
    userAccountContext: string,
): string => `Review a proposed professional-background classification before it is saved.
Return ONLY compact JSON, no markdown:
{"response":"message","background":{"status":"FOUND|NONE|UNKNOWN","role":null,"yearsOfExperience":null,"companies":[],"technologies":[],"education":[],"summary":null},"mode":null,"advance":false}

Rules:${COMMON_RULES}
- FOUND requires actual current or past work, study, project, or technical experience stated by the user.
- Supplied account context may establish real background when the latest message only states career intent.
- A desired job, target role, job-search request, or statement that the user wants something new is career intent, not professional background.
- Do not reinterpret the object of phrases such as looking for, seeking, wanting, applying for, or moving into as the user's current role.
- Preserve FOUND only when the message contains genuine background evidence. Otherwise return UNKNOWN and ask briefly for professional background.
- Always set mode=null. Direction routing happens separately.

Latest user message: ${latestUserMessage}
Account context: ${userAccountContext.slice(0, MAX_ACCOUNT_CONTEXT_CHARS) || "none"}
Prior decision: ${JSON.stringify(priorDecision)}`;

const buildDirectionPrompt = (latestUserMessage: string): string => `You classify a career-coaching user's timing preference.
Return ONLY compact JSON, no markdown:
{"response":"short acknowledgement or clarification","mode":null,"advance":false}

Rules:${COMMON_RULES}
- Set mode=NEAR_TERM for a job now, soon, the next few months, or bare "now".
- Set mode=DREAMJOB for a longer-term, future, or dream role.
- Set mode=GUIDED when the user is unsure or wants help deciding.
- When mode is set, set advance=true and respond with a short acknowledgement.
- When unclear, keep mode=null, set advance=false, and respond exactly: "Are you looking for a job now, aiming for a longer-term role in the future, or still figuring out what you want?"
- Do not repeat the user's professional background.

Latest user message: ${latestUserMessage}`;

const buildRoleChoicePrompt = (
    conversation: Conversation,
    latestUserMessage: string,
    onboardingFlow: OnboardingFlow,
): string => `You classify whether a user wants the same or a different role for their near-term job search.
Return ONLY compact JSON:
{"response":"short acknowledgement or question","roleChoice":null,"targetRole":null,"targetRoleReady":false,"targetDiscoverySubject":null,"targetDiscoveryFacts":{}}

Rules:
- Interpret informal wording and obvious spelling mistakes. "differennnt", "differernet", and "somehting diifererent" mean DIFFERENT_ROLE.
- Do not repeat the same-role/different-role question because of spelling mistakes.
- Set roleChoice=SAME_ROLE or DIFFERENT_ROLE; use null only if genuinely unclear.
- A concrete named target sets targetRole and targetRoleReady=true. Use SAME_ROLE only if it matches the current role.
- When the user names a concrete target role, do not ask them to confirm it; mark it ready and proceed.
- A bare SAME_ROLE keeps targetRole=null and targetRoleReady=false.
- For DIFFERENT_ROLE without a target, ask one personalized, high-value discovery question and describe it in targetDiscoverySubject.
- Choose from full context; enjoyed work, responsibilities, strengths, work style, domain, constraints, and setting are examples rather than a fixed sequence.
- Do not ask for information already known. Put only explicit user preferences in targetDiscoveryFacts.
- Keep responses natural; never expose JSON or routing labels.

Current role: ${onboardingFlow.background?.role ?? "unknown"}
Recent conversation:
${buildRecentHistory(conversation, latestUserMessage)}
Latest user message: ${latestUserMessage}`;

export const buildOnboardingPrompt = (
    conversation: Conversation,
    latestUserMessage: string,
    userAccountContext: string,
    onboardingFlow: OnboardingFlow,
): string => {
    if (!onboardingFlow.backgroundResolved) {
        return buildBackgroundPrompt(latestUserMessage, userAccountContext, onboardingFlow);
    }
    if (!onboardingFlow.directionResolved) {
        return buildDirectionPrompt(latestUserMessage);
    }
    return buildRoleChoicePrompt(conversation, latestUserMessage, onboardingFlow);
};
