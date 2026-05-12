import { describe, expect, it, vi } from "vitest";
import type { TextCompletionPort } from "../../../ai/ports/text-completion.types";
import type { Conversation } from "../conversation/conversation.model";
import type { ChatExternalService } from "../chat/external-route/chat.external.service";
import { DreamJobService } from "./dream-job.service";
import { createEmptyProfileSignals } from "../career-profile/career-profile.utils";
import type { UserCareerProfile } from "../career-profile/career-profile.types";

const buildProfile = (): UserCareerProfile => ({
    userId: "u1",
    ...createEmptyProfileSignals(),
    salaryExpectation: null,
    locationPreference: null,
    remotePreference: null,
    senioritySignal: null,
    uncertaintyLevel: 0.2,
    profileSummaryText: "",
    profileSummaryEmbedding: [],
    createdAt: new Date(),
    updatedAt: new Date(),
});

const buildConv = (): Conversation => ({
    userId: "u1",
    achievements: [],
    messages: [
        { role: "user", content: "I love investigating how systems fail", timestamp: new Date() },
    ],
    stageProgress: {
        currentStageIndex: 0,
        currentStageId: "achievements",
        completedStageIds: [],
        awaitingConfirmation: false,
        stageNotes: {},
    },
    createdAt: new Date(),
    updatedAt: new Date(),
});

describe("DreamJobService", () => {
    it("persists when confidence is high enough and stronger than prior", async () => {
        const patch = vi.fn().mockResolvedValue(undefined);
        const external = { patchDreamJobFields: patch } as unknown as ChatExternalService;
        const textCompletion: TextCompletionPort = {
            complete: vi.fn().mockResolvedValue(
                JSON.stringify({
                    dreamJob: "Security Researcher",
                    confidence: 85,
                    reasoning: ["Analytical", "Systems thinking"],
                })
            ),
        };
        const service = new DreamJobService(textCompletion, external);
        await service.evaluateAndPersist({
            userId: "u1",
            conversation: buildConv(),
            profile: buildProfile(),
            userSnapshot: { dreamJob: "Engineer", dreamJobConfidence: 40 },
            latestUserMessage: "I want to become a security researcher",
        });
        expect(patch).toHaveBeenCalledWith(
            "u1",
            {
                dreamJob: "Security Researcher",
                dreamJobConfidence: 85,
                dreamJobReasoning: ["Analytical", "Systems thinking"],
            },
            undefined
        );
    });

    it("skips persist when below threshold", async () => {
        const patch = vi.fn();
        const external = { patchDreamJobFields: patch } as unknown as ChatExternalService;
        const textCompletion: TextCompletionPort = {
            complete: vi.fn().mockResolvedValue(
                JSON.stringify({ dreamJob: "X", confidence: 50, reasoning: ["weak"] })
            ),
        };
        const service = new DreamJobService(textCompletion, external);
        await service.evaluateAndPersist({
            userId: "u1",
            conversation: buildConv(),
            profile: buildProfile(),
            userSnapshot: {},
            latestUserMessage: "not sure yet",
        });
        expect(patch).not.toHaveBeenCalled();
    });

    it("skips when new confidence is lower than stored", async () => {
        const patch = vi.fn();
        const external = { patchDreamJobFields: patch } as unknown as ChatExternalService;
        const textCompletion: TextCompletionPort = {
            complete: vi.fn().mockResolvedValue(
                JSON.stringify({ dreamJob: "Other", confidence: 75, reasoning: ["a"] })
            ),
        };
        const service = new DreamJobService(textCompletion, external);
        await service.evaluateAndPersist({
            userId: "u1",
            conversation: buildConv(),
            profile: buildProfile(),
            userSnapshot: { dreamJob: "Strong", dreamJobConfidence: 90 },
            latestUserMessage: "I want to pivot to something else",
        });
        expect(patch).not.toHaveBeenCalled();
    });

    it("inferDreamJob returns null when latest message is timeline-only even if model hallucinates", async () => {
        const external = { patchDreamJobFields: vi.fn() } as unknown as ChatExternalService;
        const textCompletion: TextCompletionPort = {
            complete: vi.fn().mockResolvedValue(
                JSON.stringify({ dreamJob: "Startup CEO", confidence: 88, reasoning: ["CEO", "startup"] })
            ),
        };
        const service = new DreamJobService(textCompletion, external);
        const inferred = await service.inferDreamJob({
            conversation: buildConv(),
            profile: buildProfile(),
            userSnapshot: {},
            latestUserMessage: "im looking for a long term direction",
        });
        expect(inferred).toBeNull();
    });

    it("inferDreamJob returns payload when user states explicit aspiration", async () => {
        const external = { patchDreamJobFields: vi.fn() } as unknown as ChatExternalService;
        const textCompletion: TextCompletionPort = {
            complete: vi.fn().mockResolvedValue(
                JSON.stringify({ dreamJob: "Startup CEO", confidence: 88, reasoning: ["CEO", "startup"] })
            ),
        };
        const service = new DreamJobService(textCompletion, external);
        const inferred = await service.inferDreamJob({
            conversation: buildConv(),
            profile: buildProfile(),
            userSnapshot: {},
            latestUserMessage: "I want to be a Startup CEO",
        });
        expect(inferred).toEqual({
            dreamJob: "Startup CEO",
            confidence: 88,
            reasoning: ["CEO", "startup"],
        });
    });

    it("persistDreamJobIfEligible does not patch when prior confidence is higher", async () => {
        const patch = vi.fn();
        const external = { patchDreamJobFields: patch } as unknown as ChatExternalService;
        const textCompletion: TextCompletionPort = { complete: vi.fn() };
        const service = new DreamJobService(textCompletion, external);
        const result = await service.persistDreamJobIfEligible("u1", { dreamJob: "Old", dreamJobConfidence: 92 }, {
            dreamJob: "Startup CEO",
            confidence: 80,
            reasoning: ["explicit"],
        });
        expect(result).toEqual({ persisted: false, dreamJob: "Startup CEO" });
        expect(patch).not.toHaveBeenCalled();
    });

    it("persistDreamJobIfEligible sets profileUpdateFailed when PATCH throws", async () => {
        const patch = vi.fn().mockRejectedValue(new Error("dreamJob PATCH failed: 401"));
        const external = { patchDreamJobFields: patch } as unknown as ChatExternalService;
        const textCompletion: TextCompletionPort = { complete: vi.fn() };
        const service = new DreamJobService(textCompletion, external);
        const result = await service.persistDreamJobIfEligible("u1", null, {
            dreamJob: "Technical CEO",
            confidence: 85,
            reasoning: ["explicit"],
        });
        expect(result).toEqual({ persisted: false, dreamJob: "Technical CEO", profileUpdateFailed: true });
        expect(patch).toHaveBeenCalled();
    });
});
