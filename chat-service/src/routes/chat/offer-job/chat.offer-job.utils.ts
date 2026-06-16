import type { ChatMessage } from "../chat.model";

/**
 * Sentinel phrase embedded in the assistant's "I need more details" reply.
 * Lets the next turn be recognized as a continuation of an in-progress job offer
 * without persisting extra conversation state.
 */
export const OFFER_JOB_COLLECT_MARKER = "Let's get your job posting ready";

const OFFER_JOB_INTENT_PATTERNS: readonly RegExp[] = [
    /\b(?:offer|post|publish|create|list)\s+(?:a\s+|an\s+|this\s+|my\s+)?job\b/,
    /\b(?:offer|post|publish|list)\s+(?:a\s+|an\s+)?(?:position|role|opening|vacancy)\b/,
    /\b(?:i'?m|i am|we'?re|we are)\s+hiring\b/,
    /\b(?:i|we)\s+(?:want|need|would like)\s+to\s+(?:hire|recruit|offer\s+a\s+job|post\s+a\s+job)\b/,
    /\bjob\s+(?:offer|posting|opening)\s+for\s+(?:the\s+)?(?:other\s+)?users?\b/,
];

export const isOfferJobIntent = (message: string): boolean => {
    const normalized = message.toLowerCase();
    return OFFER_JOB_INTENT_PATTERNS.some((pattern) => pattern.test(normalized));
};

/** True when the most recent assistant message was our offer-job collection prompt. */
export const wasOfferJobCollectionPromptLast = (messages: readonly ChatMessage[]): boolean => {
    for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === "assistant") {
            return messages[i].content.includes(OFFER_JOB_COLLECT_MARKER);
        }
    }
    return false;
};

/**
 * Collects the user's messages belonging to the current offer-job thread so the
 * extractor accumulates details across turns. Starts from the most recent user
 * message that expressed offer intent and includes everything after it.
 */
export const collectOfferThreadText = (messages: readonly ChatMessage[], currentMessage: string): string => {
    const userContents = messages.filter((message) => message.role === "user").map((message) => message.content);
    let startIndex = -1;
    for (let i = userContents.length - 1; i >= 0; i--) {
        if (isOfferJobIntent(userContents[i])) {
            startIndex = i;
            break;
        }
    }
    const slice = startIndex >= 0 ? userContents.slice(startIndex) : [currentMessage];
    return slice.join("\n").slice(0, 6000);
};

export const findMissingOfferFields = (draft: {
    jobTitle: string;
    company: string;
    seniority: string;
    location: string;
    requirements: string[];
    description: string;
    salary?: number;
}): string[] => {
    const missing: string[] = [];
    if (draft.jobTitle.trim().length === 0) missing.push("the job title");
    if (draft.seniority.trim().length === 0) missing.push("the experience level (e.g. junior, mid, senior)");
    if (draft.company.trim().length === 0) missing.push("the company name");
    if (draft.location.trim().length === 0) missing.push("the location (or 'remote')");
    if (draft.requirements.length === 0) missing.push("a few key requirements");
    if (draft.description.trim().length < 40) missing.push("a short role description");
    if (draft.salary === undefined || draft.salary <= 0) missing.push("the salary");
    return missing;
};
