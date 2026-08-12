import type { OnboardingFlow } from "../../../routes/conversation/conversation.model";
import {
    extractChatStatedBackgroundFacts,
    formatChatStatedFactsForPrompt,
} from "./onboarding.chat-facts.utils";

const MAX_ACCOUNT_CONTEXT_CHARS = 1_200;

const COMMON_RULES = `
- Interpret obvious spelling mistakes, transposed letters, and informal wording from context.
- If multiple meanings remain plausible, ask one concise clarification question instead of guessing.
- Keep the user-facing response concise and natural.
- Never expose JSON labels or internal routing terms in the user-facing response.`;

const buildBackgroundPrompt = (
    latestUserMessage: string,
    userAccountContext: string,
    onboardingFlow: OnboardingFlow,
): string => {
    const chatFacts = extractChatStatedBackgroundFacts(latestUserMessage);
    const chatFactsLine = formatChatStatedFactsForPrompt(chatFacts);
    const hasChatFacts = chatFacts.role !== undefined || chatFacts.yearsOfExperience !== undefined;
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
- When FOUND or NONE, respond with one short summary followed by: "Are you looking for a job now, aiming for a longer-term role in the future, or still figuring out what you want?"
- CHAT_STATED_FACTS are authoritative. Use their exact role and years in background and response; do not replace or contradict them.
- Do not invent history or include account/CV details in the response when CHAT_STATED_FACTS are present.
- If the latest message also states a direction, set mode to NEAR_TERM for a job now/soon, DREAMJOB for a future goal, GUIDED for uncertainty, otherwise null.

CHAT_STATED_FACTS: ${chatFactsLine}
backgroundAskCount=${onboardingFlow.backgroundAskCount}
${accountSection}Latest user message: ${latestUserMessage}`;
};

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

const buildRoleChoicePrompt = (latestUserMessage: string, onboardingFlow: OnboardingFlow): string => `You classify whether a user wants the same or a different role for their near-term job search.
Return ONLY compact JSON, no markdown:
{"response":"short acknowledgement","roleChoice":null,"targetRole":null,"targetRoleReady":false}

Rules:${COMMON_RULES}
- Set roleChoice=SAME_ROLE or DIFFERENT_ROLE from the latest message; otherwise null.
- Correct obvious spelling mistakes semantically. "differennnt", "differernet", and "diifererent" mean DIFFERENT_ROLE.
- Do not repeat the same-role/different-role question because of spelling mistakes.
- If the user directly names a concrete target role, set targetRole, targetRoleReady=true, and choose SAME_ROLE only when it clearly matches the current role; otherwise DIFFERENT_ROLE.
- If the user only chooses same/different without naming a target, keep targetRole=null and targetRoleReady=false.

Current role: ${onboardingFlow.background?.role ?? "unknown"}
Latest user message: ${latestUserMessage}`;

export const buildOnboardingPrompt = (
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
    return buildRoleChoicePrompt(latestUserMessage, onboardingFlow);
};
