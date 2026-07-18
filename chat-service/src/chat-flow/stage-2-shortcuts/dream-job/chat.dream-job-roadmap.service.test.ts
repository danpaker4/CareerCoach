import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CreateCareerRoadmapParams } from "../../../routes/external-chat-tools/chat.external.types";
import {
    DREAM_JOB_ROADMAP_STAGE_COUNT,
    createDreamJobRoadmapCreator,
} from "./chat.dream-job-roadmap.service";
import type {
    DreamJobRoadmapGenerator,
    DreamJobRoadmapPersistence,
    GeneratedStageContent,
} from "./chat.dream-job-roadmap.types";

type GeneratorCall = {
    userId: string;
    dreamJob: string;
    stageCount: number;
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
        generate: async (userId, dreamJob, stageCount) => {
            generatorCalls.push({ userId, dreamJob, stageCount });
            if (params.generateError === true) {
                throw new Error("Generation failed");
            }
            return { stages: params.stages ?? buildStages(DREAM_JOB_ROADMAP_STAGE_COUNT) };
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
    it("generates and persists exactly four mapped stages", async () => {
        const stages = buildStages(DREAM_JOB_ROADMAP_STAGE_COUNT);
        const { creator, generatorCalls, persistedRoadmaps, generatedAt } = createCreator({ stages });

        const result = await creator.create("user-1", "Founder");

        assert.deepEqual(result, { created: true });
        assert.deepEqual(generatorCalls, [{ userId: "user-1", dreamJob: "Founder", stageCount: 4 }]);
        assert.equal(persistedRoadmaps.length, 1);

        const persistedRoadmap = persistedRoadmaps[0];
        if (persistedRoadmap === undefined) {
            throw new Error("Expected persisted roadmap");
        }

        assert.equal(persistedRoadmap.userId, "user-1");
        assert.equal(persistedRoadmap.dreamJob, "Founder");
        assert.equal(persistedRoadmap.generatedAt, generatedAt);
        assert.deepEqual(
            persistedRoadmap.stagesToDreamJob,
            stages.map((content, index) => ({ jobId: index + 1, isDone: false, content }))
        );
    });

    it("does not persist when generation throws", async () => {
        const { creator, persistedRoadmaps } = createCreator({ generateError: true });

        const result = await creator.create("user-1", "Founder");

        assert.deepEqual(result, { created: false, reason: "generation_failed" });
        assert.equal(persistedRoadmaps.length, 0);
    });

    it("does not persist when generation returns fewer than four stages", async () => {
        const { creator, persistedRoadmaps } = createCreator({ stages: buildStages(3) });

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
