import type { CareerHorizon } from "./conversation.model";

const LONG_TERM_PHRASES: readonly string[] = [
    "long term",
    "long-term",
    "longterm",
    "long term planning",
    "long-term planning",
    "future career",
    "career vision",
    "not looking for a job",
    "not job hunting",
    "not searching for jobs",
    "plan my future",
    "years from now",
    "someday i want",
    "eventually i want",
    "where i want to end up",
    "end goal role",
    "dream role long term",
    "thinking long term",
    "focus on the future",
    /** Natural phrasing users use instead of the onboarding keywords */
    "in the future",
    "for the future",
    "looking further ahead",
    "further ahead",
    "down the road",
    "later in my career",
    "later on",
    "not right now",
    "not immediately",
    "longer term",
    "longer-term",
    /** Leadership / dream-role direction without asking for listings */
    "want to be a ceo",
    "want to be ceo",
    "wanna be a ceo",
    "wanna be ceo",
    "be a ceo",
    "become a ceo",
    "ceo of a startup",
    "ceo of a big startup",
    "run a startup",
    "start my own company",
    "found a startup",
    "found my own",
];

const IMMEDIATE_PHRASES: readonly string[] = [
    "find me a job",
    "find jobs",
    "job search",
    "looking for a job now",
    "need a job now",
    "open roles",
    "open positions",
    "apply for jobs",
    "job listings",
    "vacancies",
    "short term job",
    "asap job",
    "hire me",
];

const matchesAny = (lowered: string, phrases: readonly string[]): boolean =>
    phrases.some((phrase) => lowered.includes(phrase));

/** Returns a new horizon when the message clearly switches mode; otherwise null. */
export const inferCareerHorizonTransition = (message: string, current: CareerHorizon | undefined): CareerHorizon | null => {
    const lowered = message.trim().toLowerCase();
    if (lowered.length === 0) {
        return null;
    }
    const wantsImmediate = matchesAny(lowered, IMMEDIATE_PHRASES);
    const wantsLongTerm = matchesAny(lowered, LONG_TERM_PHRASES);
    const next: CareerHorizon | null = wantsImmediate ? "IMMEDIATE" : wantsLongTerm ? "LONG_TERM" : null;
    if (next === null) {
        return null;
    }
    const effectiveCurrent = current ?? "UNSET";
    if (next === effectiveCurrent) {
        return null;
    }
    return next;
};
