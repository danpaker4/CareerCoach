import type { Conversation } from "../../../routes/conversation/conversation.model";
import { MAX_OPEN_TARGET_ROLE_QUESTIONS } from "./onboarding.target-role.consts";

const MAX_HISTORY_MESSAGES = 40;
const MAX_HISTORY_MESSAGE_CHARS = 400;
const MAX_PRIOR_OUTPUT_CHARS = 1_000;
const MAX_ACCOUNT_CONTEXT_CHARS = 2_000;

const buildDiscoveryHistory = (conversation: Conversation, latestUserMessage: string): string => {
    const lastMessage = conversation.messages.at(-1);
    const history = lastMessage?.role === "user" && lastMessage.content === latestUserMessage
        ? conversation.messages.slice(0, -1)
        : conversation.messages;
    return history
        .slice(-MAX_HISTORY_MESSAGES)
        .map((message) => `${message.role.toUpperCase()}: ${message.content.slice(0, MAX_HISTORY_MESSAGE_CHARS)}`)
        .join("\n");
};

export const buildTargetRoleDecisionPrompt = (
    conversation: Conversation,
    latestUserMessage: string,
    userAccountContext: string,
): string => {
    const targetState = conversation.onboardingFlow?.nearTermTarget;
    const clarificationCount = targetState?.clarificationCount ?? 0;
    const suggestedRoles = targetState?.suggestedRoles ?? [];
    const mustOfferChoices = clarificationCount >= MAX_OPEN_TARGET_ROLE_QUESTIONS;
    return `
You identify the concrete role a career-coaching user wants next. The user already chose to move into a DIFFERENT role.
Return ONLY one of these compact JSON shapes, with no markdown:
{"status":"READY","targetRole":"Product Manager","discoveryFacts":{"desired_work":"own product direction"}}
{"status":"NEEDS_CLARIFICATION","question":"Which parts of your recent work gave you the most energy?","subject":"enjoyed_work","discoveryFacts":{}}
{"status":"ROLE_OPTIONS","summary":"Your technical background and interest in customer problems point to these paths.","roles":[{"title":"Product Manager","reason":"Combines technical context with product ownership."},{"title":"Solutions Engineer","reason":"Uses technical knowledge in customer-facing problem solving."},{"title":"Technical Program Manager","reason":"Focuses on coordination and delivery across technical teams."}],"discoveryFacts":{}}

Rules:
- Interpret obvious spelling mistakes and informal wording from context before deciding. A misspelled but recognizable role or domain should be treated as the intended role; ask for clarification only when multiple meanings remain plausible.
- Understand the user's natural language yourself. Do not require special phrasing or a hardcoded title list.
- READY when the user explicitly names a concrete searchable role/domain or selects one of the assistant's previously suggested roles.
- NEEDS_CLARIFICATION is allowed only before the open-question limit. Ask exactly one high-value, natural question and identify its short semantic subject. The subject describes what the question learns; it is not chosen from a fixed list.
- Choose the next subject dynamically from the full conversation, stored discovery facts, and covered subjects. Examples include enjoyed or disliked work, desired responsibilities, strengths, work style, domain, constraints, or remote/hybrid/office preference, but these are guidance rather than a checklist.
- Do not follow a fixed question order. Skip anything already known, do not repeat or paraphrase an earlier question, and ask about workplace setting only when it would materially improve the recommendations.
- ROLE_OPTIONS means: synthesize all accumulated preferences and propose 3-5 distinct concrete searchable roles with one specific fit reason each. The application formats the list and choice question.
- ROLE_OPTIONS must not include the user's current/background role because the user explicitly chose to move into a different role.
- If the user asks to see jobs without selecting a concrete role, return ROLE_OPTIONS rather than starting a broad search. Job search waits for the user to choose a role.
- Treat repeated uncertainty, inability to answer, or vague value words as a signal to switch from interrogation to ROLE_OPTIONS.
- If roles were already suggested, understand natural selections such as a role name, "the first one", or "compare the first two" from the conversation.
- Selecting one previously suggested role takes priority over mustOfferChoices: return READY with that exact role. Example: if the third suggested role is Product Manager and the user says "the third one", return READY with Product Manager.
- Use the user's background and profile as context, but use only this conversation to decide what target the user wants. Do not treat a background role as a selected target.
- discoveryFacts must contain only concise facts explicitly supported by the user's messages. Return newly learned or corrected facts using short semantic keys. Never invent a preference.
- Never ask whether they want a job now, in the future, or whether they want the same versus a different role; those decisions are already resolved.

Discovery state:
clarificationCount=${clarificationCount}
openQuestionLimit=${MAX_OPEN_TARGET_ROLE_QUESTIONS}
mustOfferChoices=${mustOfferChoices}
previouslySuggestedRoles=${JSON.stringify(suggestedRoles)}
storedDiscoveryFacts=${JSON.stringify(targetState?.discoveryFacts ?? {})}
coveredSubjects=${JSON.stringify(targetState?.coveredSubjects ?? [])}
${mustOfferChoices
        ? "You MUST NOT return NEEDS_CLARIFICATION. Return READY or ROLE_OPTIONS."
        : "You may ask one useful clarification, but prefer ROLE_OPTIONS now if the user is already struggling to answer."}

Relevant conversation:
${buildDiscoveryHistory(conversation, latestUserMessage)}
Account/profile context (background evidence only, never proof of target preference):
${userAccountContext.slice(0, MAX_ACCOUNT_CONTEXT_CHARS)}
Latest user message: ${latestUserMessage}
`;
};

export const buildTargetRoleCorrectionPrompt = (originalPrompt: string, priorOutput: string): string => `
${originalPrompt}

Your previous output was invalid or asked a question from the wrong conversation stage.
Re-evaluate the latest user message and return exactly one valid JSON object from the allowed shapes above.
Preserve a correct intent status and repair only its missing or invalid fields. ROLE_OPTIONS must include 3-5 real searchable titles and a specific reason for each.
Previous invalid output: ${priorOutput.slice(0, MAX_PRIOR_OUTPUT_CHARS)}
`;

export const buildTargetRoleGroundingPrompt = (
    conversation: Conversation,
    latestUserMessage: string,
    candidateRole: string,
): string => `
You are the final grounding check before a career-coaching app searches for jobs.
Another model proposed this candidate phrase: ${candidateRole}

Classify whether it is both a concrete searchable occupational title and explicitly chosen by the user.
Return ONLY one compact JSON object:
{"kind":"GROUNDED_ROLE","evidenceQuote":"exact words from the latest user message that name ${candidateRole}"}
{"kind":"GROUNDED_SUGGESTION","evidenceQuote":"exact words from the latest user message that select ${candidateRole} from prior suggestions"}
{"kind":"NEEDS_CLARIFICATION","question":"one concise question that identifies or confirms a concrete target role"}

Rules:
- GROUNDED_ROLE requires both conditions: the candidate is a real searchable role/title, and the latest user message explicitly names it.
- The evidenceQuote must be copied verbatim from the latest user message and must contain the candidate role itself.
- GROUNDED_SUGGESTION requires the candidate to appear in previouslySuggestedRoles and the latest message to clearly select that suggestion by name, position, or unambiguous reference.
- When the latest user message selects by position or reference and does not contain the candidate title, use GROUNDED_SUGGESTION, never GROUNDED_ROLE.
- If either condition is missing, return NEEDS_CLARIFICATION.
- A role is ready when it is concrete enough to use as a job-search query. If the user explicitly says "product manager", "engineering manager", or another searchable title, return GROUNDED_ROLE immediately.
- Do not demand a subtype, specialization, seniority, industry, or responsibilities after the user has explicitly named a searchable role.
- Preferences, skills, responsibilities, and activities do not establish a role by themselves.
- Candidate "product manager" with latest message "leading teams" is NEEDS_CLARIFICATION because the title was inferred.
- Candidate "leading teams" with latest message "leading teams" is also NEEDS_CLARIFICATION because it is an activity, not a job title.
- Generic labels such as "leading role", "important role", or "management position" without a function or domain are NEEDS_CLARIFICATION.
- Candidate "product manager" with latest message "product manager" is GROUNDED_ROLE with evidenceQuote "product manager".
- If Product Manager was the third suggested role and the latest message is "the third one", return GROUNDED_SUGGESTION with evidenceQuote "the third one".
- When clarification is needed, generate one useful question that distinguishes the plausible directions raised by the user's words.
- Do not ask about job timing or whether the user wants the same versus a different role; those are already resolved.
- Do not introduce a different target role and do not search for jobs.

Relevant conversation:
${buildDiscoveryHistory(conversation, latestUserMessage)}
Latest user message: ${latestUserMessage}
Previously suggested roles: ${JSON.stringify(conversation.onboardingFlow?.nearTermTarget?.suggestedRoles ?? [])}
`;
