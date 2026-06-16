import type { ChatMessage } from "../chat.model";

/**
 * Signature embedded in the assistant's "shall I save this?" wishlist prompt.
 * Lets the next turn be recognized as a yes/no answer without persisting extra state.
 */
export const WISHLIST_SAVE_PROMPT_MARKER = "Want me to save it to your wishlist";

export const buildWishlistSavePrompt = (title: string, leadIn: string): string =>
    `${leadIn} ${WISHLIST_SAVE_PROMPT_MARKER} as "${title}" and alert you when a matching role appears? ` +
    `To make the alert more precise you can also add your experience level (e.g. junior / mid / senior) ` +
    `and a location (a city, or "remote") — for example: "yes, save it as Senior Backend Engineer in Berlin". ` +
    `Say "yes" to save it as-is, or "no" if you'd rather not.`;

export const wasWishlistSavePromptLast = (messages: readonly ChatMessage[]): boolean => {
    for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === "assistant") {
            return messages[i].content.includes(WISHLIST_SAVE_PROMPT_MARKER);
        }
    }
    return false;
};

/** Pulls the proposed role title back out of the most recent wishlist prompt. */
export const extractProposedWishlistTitle = (messages: readonly ChatMessage[]): string | null => {
    for (let i = messages.length - 1; i >= 0; i--) {
        const message = messages[i];
        if (message.role === "assistant" && message.content.includes(WISHLIST_SAVE_PROMPT_MARKER)) {
            const match = message.content.match(/as "([^"]+)"/);
            return match ? match[1] : null;
        }
    }
    return null;
};

export type WishlistDetails = {
    jobTitle: string;
    seniority: string;
    location: string;
    company: string;
};

/** True when the user is clearly declining the wishlist save ("no", "I don't want to save", "skip"…). */
export const isWishlistDecline = (message: string): boolean => {
    const normalized = message.toLowerCase().trim();
    return (
        /^(no|nope|nah|don'?t|do not|skip|cancel|not now|forget it)\b/.test(normalized) ||
        /\b(don'?t|do not)\s+(want|need|wanna)?\s*(to\s+)?save\b/.test(normalized) ||
        /\bno\s+thanks?\b/.test(normalized) ||
        normalized === "none"
    );
};

/** True when the user is confirming/asking to save (a "yes", or an explicit "save …" instruction). */
export const isWishlistSaveConfirmation = (message: string, affirmative: boolean): boolean => {
    if (isWishlistDecline(message)) {
        return false;
    }
    return affirmative || /\bsave\b/i.test(message);
};

export const buildWishlistDetailsPrompt = (message: string, proposedTitle: string): string =>
    `The user is saving a desired job role to their wishlist; they'll be alerted when a matching role is posted. ` +
    `Extract structured fields from their reply.\n\n` +
    `Proposed role title (use as a fallback if they don't state one): "${proposedTitle}"\n\n` +
    `Return ONLY a JSON object (no markdown, no commentary): ` +
    `{"jobTitle": string, "seniority": string, "location": string, "company": string}\n` +
    `Rules:\n` +
    `- jobTitle: the clean ROLE title only, e.g. "Machine Learning Engineer". Do NOT include the location or company in it. If no role is stated, use the proposed title.\n` +
    `- seniority: one of intern, junior, mid, senior, staff, principal, manager — or "" if not stated.\n` +
    `- location: a city/country, or "remote", or "" if not stated.\n` +
    `- company: a preferred company name if they named one, otherwise "".\n\n` +
    `User reply:\n"""\n${message}\n"""`;

const wishlistAsString = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

export const parseWishlistDetailsFromJson = (rawText: string, proposedTitle: string): WishlistDetails => {
    const start = rawText.indexOf("{");
    const end = rawText.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) {
        throw new Error("No JSON object found in wishlist extraction");
    }
    const parsed: unknown = JSON.parse(rawText.slice(start, end + 1));
    if (typeof parsed !== "object" || parsed === null) {
        throw new Error("Wishlist extraction is not an object");
    }
    const obj = parsed as Record<string, unknown>;
    const jobTitle = wishlistAsString(obj.jobTitle) || proposedTitle;
    return {
        jobTitle,
        seniority: wishlistAsString(obj.seniority),
        location: wishlistAsString(obj.location),
        company: wishlistAsString(obj.company),
    };
};

export const buildKeywordsFromTitle = (title: string): string[] =>
    Array.from(
        new Set(
            title
                .toLowerCase()
                .split(/\s+/)
                .map((token) => token.trim())
                .filter((token) => token.length >= 3)
        )
    );
