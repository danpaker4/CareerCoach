import type { TextCompletionPort } from "../../../ai/ports/text-completion.types";
import type { DreamJobLlmPayload } from "../career-planning/career-planning.types";
import type { Conversation } from "../conversation/conversation.model";
import type { UserCareerProfile } from "../career-profile/career-profile.types";
import { ChatExternalService } from "../chat/external-route/chat.external.service";
import { buildDreamJobInferencePrompt } from "../llm/chat.future-planning.prompt.utils";
import { isCareerTimelinePreferenceWithoutRole } from "./dream-job-aspiration-guard.utils";
import { DREAM_JOB_PERSIST_MIN_CONFIDENCE } from "./dream-job.consts";
import { parseDreamJobPayloadFromRaw } from "./dream-job.llm.utils";

export type DreamJobPersistResult = {
    readonly persisted: boolean;
    readonly dreamJob: string;
    /** True when a PATCH was attempted but failed (e.g. users-service rejected the request). */
    readonly profileUpdateFailed?: boolean;
};

const readDreamState = (user: Record<string, unknown> | null) => {
    if (!user) {
        return { dreamJob: null as string | null, dreamJobConfidence: null as number | null };
    }
    const dreamJob = typeof user.dreamJob === "string" ? user.dreamJob : null;
    const conf = typeof user.dreamJobConfidence === "number" ? user.dreamJobConfidence : null;
    return { dreamJob, dreamJobConfidence: conf };
};

export class DreamJobService {
    constructor(
        private readonly textCompletion: TextCompletionPort,
        private readonly externalService: ChatExternalService
    ) {}

    inferDreamJob = async (params: {
        readonly conversation: Conversation;
        readonly profile: UserCareerProfile;
        readonly userSnapshot: Record<string, unknown> | null;
        readonly latestUserMessage: string;
    }): Promise<DreamJobLlmPayload | null> => {
        const savedDream = readDreamState(params.userSnapshot);
        const raw = await this.textCompletion.complete(
            buildDreamJobInferencePrompt(params.conversation, params.profile, savedDream)
        );
        const parsed = parseDreamJobPayloadFromRaw(raw);
        if (!parsed) {
            return null;
        }
        if (isCareerTimelinePreferenceWithoutRole(params.latestUserMessage)) {
            return null;
        }
        return parsed;
    };

    persistDreamJobIfEligible = async (
        userId: string,
        userSnapshot: Record<string, unknown> | null,
        parsed: DreamJobLlmPayload,
        usersAuthHeader?: string | null
    ): Promise<DreamJobPersistResult> => {
        if (parsed.confidence < DREAM_JOB_PERSIST_MIN_CONFIDENCE) {
            return { persisted: false, dreamJob: parsed.dreamJob };
        }
        const { dreamJob: existingTitle, dreamJobConfidence: existingConf } = readDreamState(userSnapshot);
        const prior = existingConf ?? 0;
        if (existingTitle && existingTitle.trim().length > 0 && parsed.confidence < prior) {
            return { persisted: false, dreamJob: parsed.dreamJob };
        }
        try {
            await this.externalService.patchDreamJobFields(
                userId,
                {
                    dreamJob: parsed.dreamJob,
                    dreamJobConfidence: Math.round(parsed.confidence),
                    dreamJobReasoning: parsed.reasoning,
                },
                usersAuthHeader
            );
        } catch {
            return { persisted: false, dreamJob: parsed.dreamJob, profileUpdateFailed: true };
        }
        return { persisted: true, dreamJob: parsed.dreamJob };
    };

    evaluateAndPersist = async (params: {
        readonly userId: string;
        readonly conversation: Conversation;
        readonly profile: UserCareerProfile;
        readonly userSnapshot: Record<string, unknown> | null;
        readonly latestUserMessage: string;
        readonly usersAuthHeader?: string | null;
    }): Promise<void> => {
        const { userId, conversation, profile, userSnapshot, latestUserMessage, usersAuthHeader } = params;
        const parsed = await this.inferDreamJob({
            conversation,
            profile,
            userSnapshot,
            latestUserMessage,
        });
        if (!parsed) {
            return;
        }
        await this.persistDreamJobIfEligible(userId, userSnapshot, parsed, usersAuthHeader).catch(() => null);
    };
}

export type { DreamJobLlmPayload };
