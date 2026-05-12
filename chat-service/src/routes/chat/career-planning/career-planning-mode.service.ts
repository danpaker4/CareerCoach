import type { Conversation } from "../conversation/conversation.model";
import type { CareerPlanningMode, CareerPlanningModeResolution } from "./career-planning.types";

const IMMEDIATE_STRONG_SIGNALS = [
    "show me jobs",
    "find jobs",
    "search jobs",
    "job search",
    "search for jobs",
    "look for jobs",
    "open positions",
    "vacancies",
    "apply now",
    "apply for",
    "job listings",
    "hiring",
    "linkedin jobs",
    "what jobs",
    "any jobs",
    "list jobs",
];

const IMMEDIATE_SIGNALS = [
    "i want a job",
    "need a job",
    "need work",
    "looking for work",
    "looking for a job",
    "looking for my next role",
    "next role",
    "job now",
    "searching now",
    "apply soon",
    "get hired",
    "find work",
    "land a job",
    "actively applying",
    "asap",
    " right now",
    "immediately",
    " need money",
    "unemployed",
    "laid off",
    " got fired",
    "looking for a new role",
    "find a new job",
    "open to opportunities",
];

const FUTURE_SIGNALS = [
    "long term",
    "long-term",
    "longterm",
    "in the future",
    "thinking about the future",
    "future career",
    "career direction",
    "dream career",
    "not searching now",
    "not job hunting",
    "not looking for a job",
    "not looking for work",
    "planning ahead",
    "still figuring it out",
    "figuring out what i want",
    "what fits me",
    "what might fit",
    "exploring options",
    "exploring careers",
    "don't know yet",
    "do not know yet",
    "no idea what i want",
    "understand what fits",
    "who i want to become",
    "want to become",
    "step back",
    "bigger picture",
    "eventually",
    "someday i want",
    "career path",
    "which field",
    "longer-term",
    "longer term",
];

const GENERIC_DISTINCTION_QUESTION =
    "Are you currently looking for a new role now, or are you more focused on figuring out your longer-term direction?";

const countUserMessages = (conversation: Conversation): number =>
    conversation.messages.filter((m) => m.role === "user").length;

const countMatches = (normalized: string, phrases: readonly string[]): number =>
    phrases.reduce((acc, phrase) => acc + (normalized.includes(phrase) ? 1 : 0), 0);

const hasAny = (normalized: string, phrases: readonly string[]): boolean =>
    phrases.some((phrase) => normalized.includes(phrase));

const mentionsFutureWord = (normalized: string): boolean => /\bfuture\b/i.test(normalized);

const mentionsNowJobIntent = (normalized: string): boolean =>
    /^now$/.test(normalized.trim()) || (/\bnow\b/.test(normalized) && normalized.length < 36);

const extractFirstName = (message: string): string | null => {
    const m = message.match(/\b(?:hi|hey)[!,.\s]+(?:im|i'm|i am)\s+([a-z]{2,20})\b/i);
    if (!m?.[1]) {
        return null;
    }
    const raw = m[1];
    return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
};

const computeSignalCounts = (normalized: string, immediateStrong: boolean) => {
    const futureWord = mentionsFutureWord(normalized);
    const nowWord = mentionsNowJobIntent(normalized);
    const immediateHits =
        countMatches(normalized, IMMEDIATE_SIGNALS)
        + (immediateStrong ? 2 : 0)
        + (nowWord ? 2 : 0);
    const futureHits = countMatches(normalized, FUTURE_SIGNALS) + (futureWord ? 1 : 0);
    const hasFuture = futureHits > 0;
    return { immediateHits, futureHits, hasFuture };
};

export class CareerPlanningModeService {
    readonly distinctionQuestionTemplate = GENERIC_DISTINCTION_QUESTION;

    buildBackgroundAckAndTimelineQuestion = (userMessage: string): string => {
        const name = extractFirstName(userMessage);
        const greet = name ? `Nice to meet you, ${name}.` : "Nice to meet you.";
        return `${greet} Thanks for sharing your background—that already gives a useful picture of your experience.\n\n${GENERIC_DISTINCTION_QUESTION}`;
    };

    resolve = (
        conversation: Conversation,
        normalizedMessage: string,
        flags: { readonly isBackgroundOnlyMessage: boolean }
    ): CareerPlanningModeResolution => {
        const normalized = normalizedMessage.toLowerCase();
        const stored = conversation.careerPlanningMode;
        const effectiveStored: CareerPlanningMode = stored ?? "UNKNOWN";
        const immediateStrong = hasAny(normalized, IMMEDIATE_STRONG_SIGNALS);
        const { immediateHits, futureHits, hasFuture } = computeSignalCounts(normalized, immediateStrong);

        if (immediateStrong && (hasAny(normalized, FUTURE_SIGNALS) || mentionsFutureWord(normalized))) {
            return this.buildClassifiedResolution("IMMEDIATE", stored, false, false, false, true, false);
        }

        const classified = this.classifyFromCounts({
            immediateStrong,
            immediateHits,
            futureHits,
            hasFuture,
            effectiveStored,
        });

        const userTurns = countUserMessages(conversation);
        const distinctionAsked = Boolean(conversation.careerPlanningDistinctionAskedAt);
        const modeIsUnknown = stored === undefined || stored === "UNKNOWN";

        if (classified !== null) {
            const explicitImmediate =
                immediateStrong || (immediateHits > 0 && !hasFuture) || immediateHits > futureHits;
            return this.buildClassifiedResolution(classified, stored, false, false, false, explicitImmediate, false);
        }

        if (modeIsUnknown && distinctionAsked && userTurns >= 2 && !immediateStrong) {
            return this.buildClassifiedResolution("IMMEDIATE", stored, false, false, true, true, false);
        }

        if (
            modeIsUnknown
            && !distinctionAsked
            && userTurns <= 2
            && !immediateStrong
            && !mentionsFutureWord(normalized)
            && countMatches(normalized, FUTURE_SIGNALS) === 0
        ) {
            return {
                effectiveMode: "UNKNOWN",
                nextStoredMode: stored === undefined ? "UNKNOWN" : null,
                shouldAskDistinctionQuestion: true,
                useBackgroundAckDistinction: flags.isBackgroundOnlyMessage && userTurns === 1,
                shouldSetDistinctionAskedAt: true,
                forceImmediateAfterAmbiguousPrompt: false,
            };
        }

        return {
            effectiveMode: effectiveStored,
            nextStoredMode: null,
            shouldAskDistinctionQuestion: false,
            useBackgroundAckDistinction: false,
            shouldSetDistinctionAskedAt: false,
            forceImmediateAfterAmbiguousPrompt: false,
        };
    };

    private classifyFromCounts = (params: {
        readonly immediateStrong: boolean;
        readonly immediateHits: number;
        readonly futureHits: number;
        readonly hasFuture: boolean;
        readonly effectiveStored: CareerPlanningMode;
    }): CareerPlanningMode | null => {
        const { immediateStrong, immediateHits, futureHits, hasFuture, effectiveStored } = params;
        if (immediateStrong) {
            return "IMMEDIATE";
        }
        if (hasFuture && immediateHits === 0) {
            return "FUTURE_PLANNING";
        }
        if (immediateHits > 0 && !hasFuture) {
            return "IMMEDIATE";
        }
        if (hasFuture && immediateHits > 0) {
            if (immediateHits > futureHits) {
                return "IMMEDIATE";
            }
            if (futureHits > immediateHits) {
                return "FUTURE_PLANNING";
            }
            return null;
        }
        return null;
    };

    private buildClassifiedResolution(
        classified: CareerPlanningMode,
        stored: CareerPlanningMode | undefined,
        shouldAskDistinctionQuestion: boolean,
        useBackgroundAckDistinction: boolean,
        shouldSetDistinctionAskedAt: boolean,
        forceImmediateAfterAmbiguousPrompt: boolean,
        explicitImmediateSignal: boolean
    ): CareerPlanningModeResolution {
        const nextStoredMode = this.computeNextStoredMode({
            classified,
            stored,
            forceImmediateAfterAmbiguousPrompt,
            explicitImmediateSignal,
        });
        return {
            effectiveMode: classified,
            nextStoredMode,
            shouldAskDistinctionQuestion,
            useBackgroundAckDistinction,
            shouldSetDistinctionAskedAt,
            forceImmediateAfterAmbiguousPrompt,
        };
    }

    private computeNextStoredMode = (params: {
        readonly classified: CareerPlanningMode;
        readonly stored: CareerPlanningMode | undefined;
        readonly forceImmediateAfterAmbiguousPrompt: boolean;
        readonly explicitImmediateSignal: boolean;
    }): CareerPlanningMode | null => {
        const { classified, stored, forceImmediateAfterAmbiguousPrompt, explicitImmediateSignal } = params;
        if (forceImmediateAfterAmbiguousPrompt) {
            return "IMMEDIATE";
        }
        const storedNorm: CareerPlanningMode = stored ?? "UNKNOWN";
        if (classified === storedNorm) {
            return null;
        }
        if (storedNorm === "UNKNOWN" && classified === "IMMEDIATE" && !explicitImmediateSignal) {
            return null;
        }
        return classified;
    };
}
