import { parseJsonObjectFromLlm } from "../../../shared/llm/json-response.utils";
import type { SanitizedJob } from "../../../../routes/conversation/job-in-conversation.types";
import type { JobSelectionResolution } from "../../follow-up/job-follow-up-answer.types";

export type PipelineJobSelectionParseResult = {
    readonly jobId: string | null;
    readonly confidence: "high" | "low";
};

export const parsePipelineJobSelectionFromJson = (
    rawText: string,
    candidates: readonly SanitizedJob[],
): PipelineJobSelectionParseResult => {
    const obj = parseJsonObjectFromLlm(rawText);
    if (!obj) {
        return { jobId: null, confidence: "low" };
    }

    const candidateIds = new Set(candidates.map((job) => job.id));
    const rawJobId = typeof obj.jobId === "string" ? obj.jobId.trim() : null;
    const jobId = rawJobId && candidateIds.has(rawJobId) ? rawJobId : null;
    const confidence = obj.confidence === "high" ? "high" : "low";
    return { jobId, confidence };
};

export const resolveSelectionFromParsedPick = (
    parsed: PipelineJobSelectionParseResult,
    candidates: readonly SanitizedJob[],
): JobSelectionResolution => {
    if (candidates.length === 0) {
        return { status: "missing" };
    }
    if (!parsed.jobId) {
        return { status: "ambiguous", options: [...candidates] };
    }
    const job = candidates.find((candidate) => candidate.id === parsed.jobId);
    if (!job) {
        return { status: "ambiguous", options: [...candidates] };
    }
    return { status: "resolved", job };
};
