import type { TextCompletionPort } from "../../../../litellm/text-completion/text-completion.types";
import type { SanitizedJob } from "../../../../routes/conversation/job-in-conversation.types";
import type { JobSelectionResolution } from "../../follow-up/job-follow-up-answer.types";
import { buildPipelineJobSelectionPrompt } from "./pipeline-job-selection.prompt.utils";
import {
    parsePipelineJobSelectionFromJson,
    resolveSelectionFromParsedPick,
} from "./pipeline-job-selection.llm.utils";

export const resolvePipelineJobSelection = async (params: {
    readonly textCompletion: TextCompletionPort;
    readonly userMessage: string;
    readonly candidates: readonly SanitizedJob[];
    readonly focusJobId: string | null;
    readonly userId: string;
}): Promise<JobSelectionResolution> => {
    const { textCompletion, userMessage, candidates, focusJobId, userId } = params;

    if (candidates.length === 0) {
        return { status: "missing" };
    }
    if (candidates.length === 1) {
        const onlyJob = candidates[0];
        if (!onlyJob) {
            return { status: "missing" };
        }
        return { status: "resolved", job: onlyJob };
    }

    const rawText = await textCompletion.complete(
        buildPipelineJobSelectionPrompt(userMessage, candidates, focusJobId),
        { operation: "chat.pipeline_job_selection", userId, responseFormat: "json" },
    );
    const parsed = parsePipelineJobSelectionFromJson(rawText, candidates);
    return resolveSelectionFromParsedPick(parsed, candidates);
};
