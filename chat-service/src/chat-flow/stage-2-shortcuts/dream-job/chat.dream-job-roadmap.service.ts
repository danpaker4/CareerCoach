import type { CreateCareerRoadmapParams } from "../../../routes/external-chat-tools/chat.external.types";
import type {
    DreamJobRoadmapCreationResult,
    DreamJobRoadmapGenerator,
    DreamJobRoadmapPersistence,
} from "./chat.dream-job-roadmap.types";

export const DREAM_JOB_ROADMAP_STAGE_COUNT = 4;

export const createDreamJobRoadmap = async (params: {
    readonly generator: DreamJobRoadmapGenerator;
    readonly persistence: DreamJobRoadmapPersistence;
    readonly userId: string;
    readonly dreamJob: string;
    readonly createGeneratedAt?: () => Date;
}): Promise<DreamJobRoadmapCreationResult> => {
    const createGeneratedAt = params.createGeneratedAt ?? (() => new Date());
    const generated = await params.generator
        .generate(params.userId, params.dreamJob, DREAM_JOB_ROADMAP_STAGE_COUNT)
        .catch(() => null);

    if (generated === null) {
        return { created: false, reason: "generation_failed" };
    }

    if (generated.stages.length !== DREAM_JOB_ROADMAP_STAGE_COUNT) {
        return { created: false, reason: "invalid_stage_count" };
    }

    const roadmapParams: CreateCareerRoadmapParams = {
        userId: params.userId,
        dreamJob: params.dreamJob,
        generatedAt: createGeneratedAt(),
        stagesToDreamJob: generated.stages.map((content, index) => ({
            jobId: index + 1,
            isDone: false,
            content,
        })),
    };

    const created = await params.persistence.createCareerRoadmap(roadmapParams).catch(() => false);
    return created ? { created: true } : { created: false, reason: "persistence_failed" };
};

export const createDreamJobRoadmapCreator = (
    generator: DreamJobRoadmapGenerator,
    persistence: DreamJobRoadmapPersistence,
    createGeneratedAt?: () => Date
) => ({
    create: (userId: string, dreamJob: string) =>
        createDreamJobRoadmap({ generator, persistence, userId, dreamJob, createGeneratedAt }),
});
