import type { ChatMessage } from "../../../api/shared/chat-message.types";

export const REJECT_CHOICE_MARKER = "Want me to broaden the search";

export type RejectChoice = "BROADEN" | "WISHLIST";

export const buildRejectChoicePrompt = (title: string): string =>
    `No problem — none of those have to be the one. ${REJECT_CHOICE_MARKER} for roles near "${title}", ` +
    `or save it to your wishlist so I can alert you when a better match is posted? ` +
    `Say "broaden" to keep looking now, or "save it" to be notified later.`;

export const wasRejectChoiceOfferedLast = (messages: readonly ChatMessage[]): boolean => {
    for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === "assistant") {
            return messages[i].content.includes(REJECT_CHOICE_MARKER);
        }
    }
    return false;
};

export const extractRejectChoiceTitle = (messages: readonly ChatMessage[]): string | null => {
    for (let i = messages.length - 1; i >= 0; i--) {
        const message = messages[i];
        if (message.role === "assistant" && message.content.includes(REJECT_CHOICE_MARKER)) {
            const match = message.content.match(/near "([^"]+)"/);
            return match ? match[1] : null;
        }
    }
    return null;
};

const BROADEN_PATTERNS: readonly RegExp[] = [
    /\bbroad(en|er)\b/,
    /\b(keep|carry on|continue)\s+(looking|searching)\b/,
    /\b(search|look)\s+(again|more|wider|further)\b/,
    /\b(show|find|suggest)\s+(me\s+)?(more|other|another|different)\b/,
    /\bmore\s+(options|roles|jobs)\b/,
    /\bwiden\b/,
];

const WISHLIST_PATTERNS: readonly RegExp[] = [
    /\bsave\b/,
    /\bwish\s?list\b/,
    /\b(alert|notify|let me know)\b/,
    /\blater\b/,
];

export const detectRejectChoice = (message: string): RejectChoice | null => {
    const normalized = message.toLowerCase().trim();
    if (normalized.length === 0) {
        return null;
    }
    const wantsBroaden = BROADEN_PATTERNS.some((pattern) => pattern.test(normalized));
    const wantsWishlist = WISHLIST_PATTERNS.some((pattern) => pattern.test(normalized));
    if (wantsBroaden && !wantsWishlist) {
        return "BROADEN";
    }
    if (wantsWishlist && !wantsBroaden) {
        return "WISHLIST";
    }
    return null;
};
