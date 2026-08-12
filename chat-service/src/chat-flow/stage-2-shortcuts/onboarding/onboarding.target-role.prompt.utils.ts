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
Return ONLY one compact JSON object with no markdown. Use exactly one of these field contracts:
- READY: status is "READY"; targetRole is the selected searchable role or domain; evidenceQuote is an exact quote from the latest user message supporting that selection; discoveryFacts is an object.
- NEEDS_CLARIFICATION: status is "NEEDS_CLARIFICATION"; question is one concise question; subject is its short semantic subject; discoveryFacts is an object.
- ROLE_OPTIONS: status is "ROLE_OPTIONS"; summary is concise; roles is an array of 3-5 objects containing title and reason; discoveryFacts is an object.
The contracts describe structure only. Generate every value from the conversation instead of copying wording from these instructions.

Rules:
- Interpret obvious spelling mistakes and informal wording from context before deciding. A misspelled but recognizable role or domain should be treated as the intended role; ask for clarification only when multiple meanings remain plausible.
- Understand the user's natural language yourself. Do not require special phrasing or a hardcoded title list.
- READY when the user explicitly names a concrete searchable role/domain or selects one of the assistant's previously suggested roles. READY always requires evidenceQuote copied exactly from the latest user message.
- NEEDS_CLARIFICATION is allowed only before the open-question limit. Ask exactly one high-value, natural question and identify its short semantic subject. The subject describes what the question learns; it is not chosen from a fixed list.
- Choose the next subject dynamically from the full conversation, stored discovery facts, and covered subjects. Examples include enjoyed or disliked work, desired responsibilities, strengths, work style, domain, constraints, or remote/hybrid/office preference, but these are guidance rather than a checklist.
- Do not follow a fixed question order. Skip anything already known, do not repeat or paraphrase an earlier question, and ask about workplace setting only when it would materially improve the recommendations.
- ROLE_OPTIONS means: synthesize all accumulated preferences and propose 3-5 distinct concrete searchable roles with one specific fit reason each. The application formats the list and choice question.
- ROLE_OPTIONS must not include the user's current/background role because the user explicitly chose to move into a different role.
- If the user asks to see jobs without selecting a concrete role, return ROLE_OPTIONS rather than starting a broad search. Job search waits for the user to choose a role.
- Treat repeated uncertainty, inability to answer, or vague value words as a signal to switch from interrogation to ROLE_OPTIONS.
- If roles were already suggested, understand natural selections such as a role name, "the first one", or "compare the first two" from the conversation.
- Selecting one previously suggested role by name, position, or unambiguous reference takes priority over mustOfferChoices. Return READY with that exact suggested role and quote the user's selection as evidenceQuote.
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
Preserve a correct intent status and repair only its missing or invalid fields. READY requires an exact evidenceQuote from the latest user message. ROLE_OPTIONS must include 3-5 real searchable titles and a specific reason for each.
Previous invalid output: ${priorOutput.slice(0, MAX_PRIOR_OUTPUT_CHARS)}
`;

export const buildTargetRoleOptionsReviewPrompt = (
    conversation: Conversation,
    latestUserMessage: string,
    priorOutput: string,
): string => `
Review the prior role decision, which returned ROLE_OPTIONS for a career-coaching user who chose to move into a different role.
Return ONLY one compact JSON object with one of these contracts:
- KEEP_OPTIONS: verdict is "KEEP_OPTIONS" and there are no other fields.
- READY: verdict is "READY"; targetRole is the shortest searchable role or domain explicitly selected by the user; evidenceQuote is the exact supporting text from the latest user message.

The latest user message is authoritative. Use KEEP_OPTIONS unless it explicitly names a concrete searchable role/domain or unambiguously selects a previously suggested role. A broad activity, responsibility, skill, or interest is not READY. Do not infer an adjacent role, and do not copy role or preference values from the surrounding instructions.
Relevant conversation:
${buildDiscoveryHistory(conversation, latestUserMessage)}
Latest user message: ${latestUserMessage}
Previously suggested roles: ${JSON.stringify(conversation.onboardingFlow?.nearTermTarget?.suggestedRoles ?? [])}
Prior decision: ${priorOutput.slice(0, MAX_PRIOR_OUTPUT_CHARS)}
`;

export const buildTargetRoleGroundingPrompt = (
    conversation: Conversation,
    latestUserMessage: string,
    candidateRole: string,
): string => `
You are the final grounding check before a career-coaching app searches for jobs.
Another model proposed this candidate phrase: ${candidateRole}

Classify whether it is a concrete searchable role or established job domain explicitly chosen by the user. Return ONLY one compact JSON object with no markdown. Use exactly one field contract:
- GROUNDED_ROLE: kind is "GROUNDED_ROLE"; evidenceQuote exactly quotes the role from the latest user message; normalizedTargetRole is its canonical searchable form.
- GROUNDED_SUGGESTION: kind is "GROUNDED_SUGGESTION"; evidenceQuote exactly quotes how the latest message selects the candidate from previously suggested roles.
- GROUNDED_CONFIRMATION: kind is "GROUNDED_CONFIRMATION"; evidenceQuote exactly quotes the confirmation; normalizedTargetRole is the canonical searchable role.
- NEEDS_CLARIFICATION: kind is "NEEDS_CLARIFICATION"; question is one concise question that identifies or confirms a concrete target role.
The kind field must be a top-level string property. Never use a kind value such as GROUNDED_ROLE as an object key, and never wrap the result in another object.
The contracts describe structure only. Generate every value from the conversation.

Rules:
- GROUNDED_ROLE requires both conditions: the candidate is a real searchable role or established job domain, and the latest user message explicitly names it.
- The evidenceQuote must be copied verbatim from the latest user message, including any typo or informal spelling.
- normalizedTargetRole must correct obvious spelling mistakes and capitalization so it is suitable for job search, while preserving the user's intended role or domain.
- Do not add a specialization, seniority, or adjacent title that the user did not choose.
- GROUNDED_SUGGESTION requires the candidate to appear in previouslySuggestedRoles and the latest message to clearly select that suggestion by name, position, or unambiguous reference.
- When the latest user message selects by position or reference and does not contain the candidate title, use GROUNDED_SUGGESTION, never GROUNDED_ROLE.
- GROUNDED_CONFIRMATION requires the immediately previous assistant message to ask the user to confirm this candidate, and the latest user message to unambiguously confirm it.
- A generic acknowledgement is not confirmation unless it directly answers that immediately preceding candidate-role confirmation question.
- If either condition is missing, return NEEDS_CLARIFICATION.
- A target is ready when it is concrete enough to use as a job-search query. Explicitly named job domains are valid without inventing a more specific title.
- Do not demand a subtype, specialization, seniority, industry, or responsibilities after the user has explicitly named a searchable role.
- Preferences, skills, responsibilities, and activities do not establish a role by themselves.
- Activities, responsibilities, and generic leadership labels without a function or domain require clarification.
- Correct spelling and capitalization only in normalizedTargetRole; evidenceQuote must remain verbatim.
- When clarification is needed, generate one useful question that distinguishes the plausible directions raised by the user's words.
- Do not ask about job timing or whether the user wants the same versus a different role; those are already resolved.
- Do not introduce a different target role and do not search for jobs.

Relevant conversation:
${buildDiscoveryHistory(conversation, latestUserMessage)}
Latest user message: ${latestUserMessage}
Immediately previous assistant message: ${[...conversation.messages].reverse().find((message) => message.role === "assistant")?.content ?? "none"}
Previously suggested roles: ${JSON.stringify(conversation.onboardingFlow?.nearTermTarget?.suggestedRoles ?? [])}
`;

export const buildTargetRoleGroundingCorrectionPrompt = (originalPrompt: string, priorOutput: string): string => `
${originalPrompt}

Your previous grounding output was invalid. Re-evaluate the candidate against the latest user message and return exactly one JSON object using a grounding field contract above. Do not return a target-role decision status or role options.
Previous invalid output: ${priorOutput.slice(0, MAX_PRIOR_OUTPUT_CHARS)}
`;
