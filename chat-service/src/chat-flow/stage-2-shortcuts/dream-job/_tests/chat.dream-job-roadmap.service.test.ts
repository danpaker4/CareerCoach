import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CreateCareerRoadmapParams } from "../../../../routes/external-chat-tools/chat.external.types";
import { DREAM_JOB_ROADMAP_DEFAULT_TARGET_YEARS } from "../chat.dream-job-roadmap.consts";
import { createDreamJobRoadmapCreator } from "../chat.dream-job-roadmap.service";
import type {
    DreamJobRoadmapGenerator,
    DreamJobRoadmapPersistence,
    GeneratedStageContent,
} from "../chat.dream-job-roadmap.types";

type GeneratorCall = {
    userId: string;
    dreamJob: string;
    targetYears: number;
};

type CreateServiceParams = {
    stages?: GeneratedStageContent[];
    generateError?: boolean;
    persistResult?: boolean;
    generatedAt?: Date;
};

const buildStage = (label: string): GeneratedStageContent => ({
    label,
    description: `${label} description`,
    actions: [`Complete ${label}`],
    resources: [],
    estimatedTimeframe: "1 month",
});

const buildStages = (count: number): GeneratedStageContent[] =>
    Array.from({ length: count }, (_, index) => buildStage(`Stage ${index + 1}`));

const createCreator = (params: CreateServiceParams = {}) => {
    const generatorCalls: GeneratorCall[] = [];
    const persistedRoadmaps: CreateCareerRoadmapParams[] = [];
    const generatedAt = params.generatedAt ?? new Date("2026-01-02T03:04:05.000Z");

    const generator: DreamJobRoadmapGenerator = {
        generate: async (userId, dreamJob, targetYears) => {
            generatorCalls.push({ userId, dreamJob, targetYears });
            if (params.generateError === true) {
                throw new Error("Generation failed");
            }
            return {
                stages: params.stages ?? buildStages(4),
                progressionMeta: {
                    dreamRoleCategory: dreamJob,
                    generationVersion: "2.0.0",
                    generationMode: "legacy-llm",
                },
            };
        },
    };

    const persistence: DreamJobRoadmapPersistence = {
        createCareerRoadmap: async (roadmap) => {
            persistedRoadmaps.push(roadmap);
            return params.persistResult ?? true;
        },
    };

    return {
        creator: createDreamJobRoadmapCreator(generator, persistence, () => generatedAt),
        generatorCalls,
        persistedRoadmaps,
        generatedAt,
    };
};

describe("createDreamJobRoadmapCreator", () => {
    it("generates with targetYears and persists stages plus progressionMeta", async () => {
        const stages = buildStages(4);
        const { creator, generatorCalls, persistedRoadmaps, generatedAt } = createCreator({ stages });

        const result = await creator.create("user-1", "Founder");

        assert.deepEqual(result, { created: true });
        assert.deepEqual(generatorCalls, [
            { userId: "user-1", dreamJob: "Founder", targetYears: DREAM_JOB_ROADMAP_DEFAULT_TARGET_YEARS },
        ]);
        assert.equal(persistedRoadmaps.length, 1);

        const persistedRoadmap = persistedRoadmaps[0];
        if (persistedRoadmap === undefined) {
            throw new Error("Expected persisted roadmap");
        }

        assert.equal(persistedRoadmap.userId, "user-1");
        assert.equal(persistedRoadmap.dreamJob, "Founder");
        assert.equal(persistedRoadmap.generatedAt, generatedAt);
        assert.equal(persistedRoadmap.progressionMeta?.dreamRoleCategory, "Founder");
        assert.deepEqual(
            persistedRoadmap.stagesToDreamJob,
            stages.map((content, index) => ({ jobId: index + 1, isDone: false, content }))
        );
    });

    it("forwards an explicit targetYears value to the generator", async () => {
        const { creator, generatorCalls } = createCreator();
        const result = await creator.create("user-1", "Chief Executive Officer", 7);
        assert.deepEqual(result, { created: true });
        assert.deepEqual(generatorCalls, [
            { userId: "user-1", dreamJob: "Chief Executive Officer", targetYears: 7 },
        ]);
    });

    it("does not persist when generation throws", async () => {
        const { creator, persistedRoadmaps } = createCreator({ generateError: true });

        const result = await creator.create("user-1", "Founder");

        assert.deepEqual(result, { created: false, reason: "generation_failed" });
        assert.equal(persistedRoadmaps.length, 0);
    });

    it("does not persist when generation returns fewer than two stages", async () => {
        const { creator, persistedRoadmaps } = createCreator({ stages: buildStages(1) });

        const result = await creator.create("user-1", "Founder");

        assert.deepEqual(result, { created: false, reason: "invalid_stage_count" });
        assert.equal(persistedRoadmaps.length, 0);
    });

    it("returns failure when roadmap persistence fails", async () => {
        const { creator, persistedRoadmaps } = createCreator({ persistResult: false });

        const result = await creator.create("user-1", "Founder");

        assert.deepEqual(result, { created: false, reason: "persistence_failed" });
        assert.equal(persistedRoadmaps.length, 1);
    });
});
