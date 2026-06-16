export type PipelineIntent = "PIPELINE_ACCEPT" | "PIPELINE_REJECT";

const ACCEPT_PHRASES = [
    "add to pipeline",
    "add it to my pipeline",
    "add it to the pipeline",
    "add to my pipeline",
    "add it",
    "move forward",
    "let's do it",
    "lets do it",
    "sounds good",
    "sounds great",
    "i want to apply",
    "i want it",
    "put it in my pipeline",
];

const REJECT_PHRASES = [
    "no thanks",
    "thanks but no",
    "not this one",
    "another one",
    "show me something else",
    "something else",
    "different job",
    "different role",
    "i don't like it",
    "i dont like it",
    "i dont like this",
    "i don't like this",
    "not for me",
    "none of these",
    "none of them",
    "none of those",
    "none fit",
    "not interested",
    "neither",
    "skip",
    "next",
    "pass",
];

const isStandaloneNone = (normalized: string): boolean =>
    normalized === "none" || /^none[,.!]?$/i.test(normalized);

// A selection like "add the first one" / "add the Intel role" / "the 2nd one" means accept.
const isPipelineSelection = (normalized: string): boolean =>
    /\badd\b/.test(normalized) ||
    /\b(first|second|third|fourth|fifth|1st|2nd|3rd|4th|5th)\b/.test(normalized);

const normalize = (message: string): string =>
    message
        .toLowerCase()
        .trim()
        .replace(/\s+/g, " ");

const isNoIdea = (normalized: string): boolean =>
    /^no\s+idea\b/i.test(normalized) || normalized.includes("no idea what");

const isStandaloneNo = (normalized: string): boolean =>
    normalized === "no" || normalized === "nope" || normalized === "nah" || /^no[,.!]?$/i.test(normalized);

const startsWithYes = (normalized: string): boolean => /^yes\b/i.test(normalized) || /^yeah\b/i.test(normalized) || /^yep\b/i.test(normalized);

const startsWithSure = (normalized: string): boolean => /^sure\b/i.test(normalized) || /^ok\b/i.test(normalized) || /^okay\b/i.test(normalized);

export class PipelineIntentService {
    detect = (message: string): PipelineIntent | null => {
        const normalized = normalize(message);
        if (normalized.length === 0) {
            return null;
        }

        if (isNoIdea(normalized)) {
            return null;
        }

        if (REJECT_PHRASES.some((phrase) => normalized.includes(phrase))) {
            return "PIPELINE_REJECT";
        }

        if (isStandaloneNo(normalized) || isStandaloneNone(normalized)) {
            return "PIPELINE_REJECT";
        }

        if (ACCEPT_PHRASES.some((phrase) => normalized.includes(phrase))) {
            return "PIPELINE_ACCEPT";
        }

        if (isPipelineSelection(normalized)) {
            return "PIPELINE_ACCEPT";
        }

        if (startsWithYes(normalized) || startsWithSure(normalized)) {
            return "PIPELINE_ACCEPT";
        }

        return null;
    };
}
