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

    return `You classify professional background for a career coach. Return ONLY compact JSON:
{"response":"","background":{"status":"FOUND|NONE|UNKNOWN","role":null,"yearsOfExperience":null,"companies":[],"technologies":[],"education":[],"summary":null},"mode":null,"advance":false}

Rules:
1. response is the complete concise reply; never empty, a placeholder, an internal label, or only in summary.
2. FOUND = explicit work, study, project, or technical experience. NONE = explicit no experience or first job. Both set advance=true. Otherwise UNKNOWN, advance=false, and ask once for background.
3. Job-search intent is not background. Understand role descriptions yourself, but never treat what the user is looking for, seeking, or wanting as a current/past role.
4. CHAT_STATED_FACTS are authoritative: do not replace or contradict name, role, or years. Correct spelling and express them in natural professional language. With chat facts, do not invent or mention account/CV history.
5. For FOUND/NONE, give a short summary, then ask exactly: "Are you looking for a job now, aiming for a longer-term role in the future, or still figuring out what you want?"
6. Interpret obvious informal wording; clarify only genuine ambiguity. Always set mode=null.

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
{"response":"","background":{"status":"FOUND|NONE|UNKNOWN","role":null,"yearsOfExperience":null,"companies":[],"technologies":[],"education":[],"summary":null},"mode":null,"advance":false}

Rules:${COMMON_RULES}
- Put the complete user-facing reply in response. Never leave it empty, return a placeholder, or put a question only in background.summary.
- FOUND requires actual current or past work, study, project, or technical experience stated by the user.
- Supplied account context may establish real background when the latest message only states career intent.
- A desired job, target role, job-search request, or statement that the user wants something new is career intent, not professional background.
- Do not reinterpret the object of phrases such as looking for, seeking, wanting, applying for, or moving into as the user's current role.
- Preserve FOUND only when the message contains genuine background evidence. Otherwise return UNKNOWN and ask briefly for professional background.
- Always set mode=null. Direction routing happens separately.

Latest user message: ${latestUserMessage}
Account context: ${userAccountContext.slice(0, MAX_ACCOUNT_CONTEXT_CHARS) || "none"}
Prior decision: ${JSON.stringify(priorDecision)}`;

const buildDirectionPrompt = (latestUserMessage: string, onboardingFlow: OnboardingFlow): string => `You classify a career-coaching user's timing preference.
Return ONLY compact JSON, no markdown:
{"response":"short acknowledgement, discovery question, or clarification","mode":null,"advance":false,"targetDiscoverySubject":null}

Rules:${COMMON_RULES}
- Set mode=NEAR_TERM for a job now/soon, the next few months, or a first job. Treat "first job" as NEAR_TERM even without the word "now".
- Set mode=DREAMJOB for a longer-term, future, or dream role.
- Set mode=GUIDED when the user is unsure or wants help deciding.
- When mode is set, set advance=true and respond with a short acknowledgement.
- When mode=NEAR_TERM and Current role is none, ask one easy, natural question designed to quickly distinguish plausible job paths. It should gather 2-3 related job-relevant signals in one answer and set targetDiscoverySubject to its semantic focus.
- Generate the question from context. Use concrete choices or examples when helpful, but do not assume preferences, suggest roles, use a fixed script, or ask a generic continuation question.
- When unclear, keep mode=null, set advance=false, and respond exactly: "Are you looking for a job now, aiming for a longer-term role in the future, or still figuring out what you want?"
- Do not repeat the user's professional background.

Current role: ${onboardingFlow.background?.role ?? "none"}
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
- For DIFFERENT_ROLE without a target, ask one personalized, high-value discovery question that collects 2-3 related signals for distinguishing job paths; describe its focus in targetDiscoverySubject.
- Choose dynamic discriminators from context; possible dimensions are examples rather than a fixed sequence. Avoid generic continuation questions.
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
        return buildDirectionPrompt(latestUserMessage, onboardingFlow);
    }
    return buildRoleChoicePrompt(conversation, latestUserMessage, onboardingFlow);
};
