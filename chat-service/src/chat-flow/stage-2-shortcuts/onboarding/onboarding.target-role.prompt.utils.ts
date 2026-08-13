import type { Conversation } from "../../../routes/conversation/conversation.model";
import {
    MAX_OPEN_TARGET_ROLE_QUESTIONS,
} from "./onboarding.target-role.consts";

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
    const rejectedSuggestedRoles = targetState?.rejectedSuggestedRoles ?? [];
    const mustOfferChoices = clarificationCount >= MAX_OPEN_TARGET_ROLE_QUESTIONS && suggestedRoles.length === 0;
    const currentRole = conversation.onboardingFlow?.background?.role?.trim();
    const roleContext = currentRole
        ? "The user chose to move into a different role."
        : "The user has no current role and is choosing a first target role.";
    return `You identify the user's next concrete job target. ${roleContext}
Return ONLY one compact JSON object, using one contract:
- READY: {"status":"READY","targetRole":"","evidenceQuote":"exact latest-user quote","discoveryFacts":{}}
- NEEDS_CLARIFICATION: status, question, subject, discoveryFacts, and rejectedSuggestedRoles
- ROLE_OPTIONS: {"status":"ROLE_OPTIONS","summary":"","roles":[{"title":"","reason":""}],"discoveryFacts":{}}
Generate values from the conversation; contract strings are not answers.

Decision policy, in order:
1. READY only for a concrete searchable role/domain explicitly named now or unambiguously selected from prior suggestions. Copy exact evidenceQuote. A selected suggestion overrides mustOfferChoices.
2. ROLE_OPTIONS gives 3-5 distinct searchable roles. Use it when requested, at the question limit, or when known skills or preferences distinguish useful paths; background, timing, and uncertainty do not count.
3. Otherwise NEEDS_CLARIFICATION, only before the limit. Ask one easy, concise question that maximizes information gain by collecting 2-3 related job-relevant signals which distinguish plausible paths. Choose those signals dynamically from what is unknown; do not follow a fixed checklist.

Discovery quality:
- Build on known facts and skip covered subjects. Never repeat/paraphrase a question or ask a generic continuation question that only invites elaboration.
- For NEEDS_CLARIFICATION, subject must be a short snake_case topic specific to the generated question. Never return placeholder labels such as "semantic focus", "subject", "focus", or "topic".
- Use concrete tradeoffs or examples when they make answering easier. After an uncertain answer, make the next question easier and more concrete.
- Save each distinct newly stated signal as its own discoveryFacts entry with a short semantic key. Facts and option reasons must be explicit; never infer preferences from inexperience or uncertainty.
- Every discoveryFacts value must be a short string. Never use booleans, arrays, or objects as fact values.
- If all active suggestions are rejected, mark rejectedSuggestedRoles=true and ask about a new discriminator; do not replace or repeat the list unless asked.

Boundaries:
- Interpret informal wording and obvious typos. Ask only when meaning is genuinely ambiguous.
- A broad interest/activity/skill is evidence, not a selected role. Background/profile is context, not proof of target preference.
- Do not repeat prior/rejected titles unless selected. Exclude the current role after a change-role choice.
- A request to see jobs without a selected role means ROLE_OPTIONS; search starts only after selection.
- Never revisit timing or same-vs-different-role decisions.

Discovery state:
clarificationCount=${clarificationCount}
openQuestionLimit=${MAX_OPEN_TARGET_ROLE_QUESTIONS}
mustOfferChoices=${mustOfferChoices}
previouslySuggestedRoles=${JSON.stringify(suggestedRoles)}
rejectedSuggestedRoles=${JSON.stringify(rejectedSuggestedRoles)}
storedDiscoveryFacts=${JSON.stringify(targetState?.discoveryFacts ?? {})}
coveredSubjects=${JSON.stringify(targetState?.coveredSubjects ?? [])}
${mustOfferChoices
        ? "NEEDS_CLARIFICATION is forbidden now; return READY or ROLE_OPTIONS."
        : "Follow the decision policy above."}

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
For NEEDS_CLARIFICATION, generate a specific snake_case subject that names the question's actual topic; never copy schema or placeholder wording.
Previous invalid output: ${priorOutput.slice(0, MAX_PRIOR_OUTPUT_CHARS)}
`;

export const buildTargetRoleDiscoveryRecoveryPrompt = (
    conversation: Conversation,
    latestUserMessage: string,
): string => `
You are a career coach choosing the next discovery question for a first-time job seeker who does not know which role fits yet.
Return ONLY one compact JSON object: {"status":"NEEDS_CLARIFICATION","question":"","discoveryFacts":{}}

Rules:
- Generate one natural question ending in "?". The question must come from the conversation, not from this instruction.
- Ask about 2-3 concrete, related preferences that distinguish plausible job paths, using easy choices when helpful.
- Build on interests the user already stated and make an uncertain user's next question easier to answer.
- Do not ask for a job title, ask what role they want, ask generic "what aspects" questions, or revisit timing.
- Do not repeat or paraphrase an earlier assistant question.
- Put newly stated facts in discoveryFacts using short semantic keys and string values only.

Stored discovery facts: ${JSON.stringify(conversation.onboardingFlow?.nearTermTarget?.discoveryFacts ?? {})}
Covered subjects: ${JSON.stringify(conversation.onboardingFlow?.nearTermTarget?.coveredSubjects ?? [])}
Relevant conversation:
${buildDiscoveryHistory(conversation, latestUserMessage)}
Latest user message: ${latestUserMessage}
`;

export const buildTargetRoleOptionsReviewPrompt = (
    conversation: Conversation,
    latestUserMessage: string,
    priorOutput: string,
): string => {
    const targetState = conversation.onboardingFlow?.nearTermTarget;
    const clarificationCount = targetState?.clarificationCount ?? 0;
    const mustOfferChoices = clarificationCount >= MAX_OPEN_TARGET_ROLE_QUESTIONS
        && (targetState?.suggestedRoles?.length ?? 0) === 0;
    const reviewContext = conversation.onboardingFlow?.background?.role?.trim()
        ? "The user chose to move into a different role."
        : "The user is choosing a first target role.";
    return `
Review the prior role decision, which returned ROLE_OPTIONS. ${reviewContext}
Return ONLY one compact JSON object with one of these contracts:
- KEEP_OPTIONS: verdict is "KEEP_OPTIONS" and there are no other fields.
- READY: verdict is "READY"; targetRole is the shortest searchable role or domain explicitly selected by the user; evidenceQuote is the exact supporting text from the latest user message.
- RESUME_DISCOVERY: verdict is "RESUME_DISCOVERY"; question is one concise, model-generated discovery question; subject is its short semantic subject; discoveryFacts contains only facts explicitly supported by the user's messages; rejectedSuggestedRoles is true only when the user rejected the active suggestions.

Rules:
- The latest user message is authoritative. Use READY only when it explicitly names a concrete searchable role/domain or unambiguously selects a previously suggested role.
- Use KEEP_OPTIONS only when known skills or preferences distinguish the options, the question limit was reached, or suggestions were requested. Background, timing, and uncertainty are insufficient.
- Use RESUME_DISCOVERY when preferences are still insufficient, when a single uncertain answer caused premature options, when the options invent preferences, or when the user rejects all active suggestions.
- A broad activity, responsibility, skill, or interest is not READY. Do not infer an adjacent role.
- The discovery question must be easy and concrete, collect 2-3 related job-relevant signals, and distinguish plausible paths. Avoid generic continuation, repetition, or paraphrase.
- If the user rejected the active options, set rejectedSuggestedRoles=true and do not repeat those titles.
- Do not copy role, preference, or question values from these instructions.
Discovery state:
clarificationCount=${clarificationCount}
openQuestionLimit=${MAX_OPEN_TARGET_ROLE_QUESTIONS}
mustOfferChoices=${mustOfferChoices}
storedDiscoveryFacts=${JSON.stringify(targetState?.discoveryFacts ?? {})}
coveredSubjects=${JSON.stringify(targetState?.coveredSubjects ?? [])}
rejectedSuggestedRoles=${JSON.stringify(targetState?.rejectedSuggestedRoles ?? [])}
Relevant conversation:
${buildDiscoveryHistory(conversation, latestUserMessage)}
Latest user message: ${latestUserMessage}
Active suggested roles: ${JSON.stringify(targetState?.suggestedRoles ?? [])}
Prior decision: ${priorOutput.slice(0, MAX_PRIOR_OUTPUT_CHARS)}
`;
};

export const buildTargetRoleOptionsReviewCorrectionPrompt = (
    originalPrompt: string,
    priorOutput: string,
): string => `
${originalPrompt}

Your previous review output was invalid, inferred a role the user did not select, or repeated a covered question.
Return exactly one valid review object. If more discovery is needed, ask a new natural-language question ending in "?" about an uncovered topic and give it a specific snake_case subject.
Previous invalid review: ${priorOutput.slice(0, MAX_PRIOR_OUTPUT_CHARS)}
`;

export const buildTargetRoleSuggestionReviewPrompt = (
    latestUserMessage: string,
    suggestedRoles: readonly string[],
): string => `
Decide whether the latest reply selects one of the numbered roles. Return JSON only:
- SELECTED: {"verdict":"SELECTED","targetRole":"exact title from Active suggestions","evidenceQuote":"exact latest-user quote"}
- CLARIFY_SELECTION: {"verdict":"CLARIFY_SELECTION","question":"ask which listed role they mean"}
- CONTINUE_DISCOVERY: {"verdict":"CONTINUE_DISCOVERY"}

Infer references semantically from order, wording, meaning, and tone; the user need not repeat a title.
Use SELECTED for one clear preference, CLARIFY_SELECTION only for an unclear referent, and CONTINUE_DISCOVERY when no role was chosen.
For SELECTED, copy targetRole exactly from the list and evidenceQuote exactly from the reply.

Roles:
${suggestedRoles.map((role, index) => `${index + 1}. ${role}`).join("\n")}
Reply: ${latestUserMessage}
`;

export const buildTargetRoleSuggestionReviewCorrectionPrompt = (
    originalPrompt: string,
    priorOutput: string,
): string => `
${originalPrompt}

Repair the invalid output using one allowed JSON shape. Copy selected titles from Roles and evidence from Reply.
Previous invalid review: ${priorOutput.slice(0, MAX_PRIOR_OUTPUT_CHARS)}
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
