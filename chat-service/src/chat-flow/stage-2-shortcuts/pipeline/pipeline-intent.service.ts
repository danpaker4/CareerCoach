import type { PipelineIntent } from "./pipeline.types";
import { PIPELINE_INTENT } from "./pipeline.consts";

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
    "skip",
    "next",
    "pass",
];

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

export const detectPipelineIntent = (message: string): PipelineIntent | null => {
    const normalized = normalize(message);
    if (normalized.length === 0) {
        return null;
    }

    if (isNoIdea(normalized)) {
        return null;
    }

    if (REJECT_PHRASES.some((phrase) => normalized.includes(phrase))) {
        return PIPELINE_INTENT.REJECT;
    }

    if (isStandaloneNo(normalized)) {
        return PIPELINE_INTENT.REJECT;
    }

    if (ACCEPT_PHRASES.some((phrase) => normalized.includes(phrase))) {
        return PIPELINE_INTENT.ACCEPT;
    }

    if (startsWithYes(normalized) || startsWithSure(normalized)) {
        return PIPELINE_INTENT.ACCEPT;
    }

    return null;
};
