import type { ChatMessage } from "../chat.model";

/** Signature embedded in the assistant's "want to refine?" offer, used to avoid re-offering. */
export const REFINE_OFFER_MARKER = "Want to make your search more specific";

const JOB_WANT_PATTERNS: readonly RegExp[] = [
    /\b(?:i|we)\s+(?:want|need|would like|'?m looking for|am looking for)\s+(?:a\s+)?(?:job|role|position|gig|work)\b/,
    /\bfind\s+me\s+(?:a\s+)?(?:job|jobs|role|roles|position|work)\b/,
    /\blooking\s+for\s+(?:a\s+)?(?:job|role|position|work)\b/,
    /\b(?:suggest|show|recommend|get)\s+(?:me\s+)?(?:some\s+)?(?:jobs?|roles?)\b/,
    /\bi\s+want\s+a\s+job\s+(?:at|in|as)\b/,
];

const SENIORITY_HINT = /\b(intern|internship|junior|entry[- ]?level|mid|senior|staff|principal|lead|manager|\d+\s*years?)\b/i;
const LOCATION_HINT = /\b(remote|hybrid|on[- ]?site|in\s+[A-Z][a-z]+|at\s+[A-Z][a-z]+)\b/;

export const isJobWantIntent = (message: string): boolean => {
    const normalized = message.toLowerCase();
    return JOB_WANT_PATTERNS.some((pattern) => pattern.test(normalized));
};

/** When the request already names seniority AND a location, it's specific enough — skip the offer. */
export const isAlreadySpecific = (message: string): boolean =>
    SENIORITY_HINT.test(message) && LOCATION_HINT.test(message);

export const wasRefineOfferedBefore = (messages: readonly ChatMessage[]): boolean =>
    messages.some((message) => message.role === "assistant" && message.content.includes(REFINE_OFFER_MARKER));

export const buildRefineOfferReply = (): string =>
    `${REFINE_OFFER_MARKER}? If you tell me your experience level, any preferred companies, ` +
    `and a location (or "remote"), I can tailor the matches. ` +
    `Or just say "search now" and I'll go with what I have.`;

const PROCEED_PATTERNS: readonly RegExp[] = [
    /\b(?:search|go|just search|search now|no thanks?|skip|nope|just show|whatever|anything)\b/,
];

/** True when the user declines refinement and wants to search immediately. */
export const wantsToSkipRefine = (message: string): boolean => {
    const normalized = message.toLowerCase();
    return PROCEED_PATTERNS.some((pattern) => pattern.test(normalized));
};
