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
] as const;

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
    "none of this",
    "nothing from here",
    "nothing here",
    "nothing fits",
    "nothing suits",
    "nothing for me",
    "not interested",
    "neither",
    "skip",
    "next",
    "pass",
] as const;

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

/** Explicit add/select phrasing — safe to handle even after awaitingPipelineDecision is cleared. */
export const isExplicitPipelineAddIntent = (message: string): boolean => {
    const normalized = normalize(message);
    if (normalized.length === 0) {
        return false;
    }
    if (ACCEPT_PHRASES.some((phrase) => normalized.includes(phrase))) {
        return true;
    }
    return isPipelineSelection(normalized);
};

export const isAllShortlistedJobsAddIntent = (message: string, presentedJobCount?: number): boolean => {
    const normalized = normalize(message);
    const hasAddAction = /\b(?:add|put|save)\b/.test(normalized);
    const targetsAll = /\b(?:all|every)\b/.test(normalized);
    if (!hasAddAction) return false;
    if (targetsAll) return true;
    if (presentedJobCount !== 2) return false;

    const targetsBoth = /\bboth\b/.test(normalized);
    const targetsCompletePair = /\b(?:this|these|those|the)\s+(?:two|2)\b/.test(normalized)
        || /\b(?:two|2)\s+(?:jobs|roles|ones|opportunities)\b/.test(normalized);
    return targetsBoth || targetsCompletePair;
};

export const isExplicitWishlistAddIntent = (message: string): boolean => {
    const normalized = normalize(message);
    return /\b(?:add|put|save)\b/.test(normalized) && /\bwish\s*list\b/.test(normalized);
};

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

    if (isStandaloneNo(normalized) || isStandaloneNone(normalized)) {
        return PIPELINE_INTENT.REJECT;
    }

    if (isExplicitPipelineAddIntent(message)) {
        return PIPELINE_INTENT.ACCEPT;
    }

    if (startsWithYes(normalized) || startsWithSure(normalized)) {
        return PIPELINE_INTENT.ACCEPT;
    }

    return null;
};
