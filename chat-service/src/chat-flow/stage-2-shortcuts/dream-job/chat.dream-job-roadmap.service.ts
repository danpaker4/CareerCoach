import type { CreateCareerRoadmapParams } from "../../../routes/external-chat-tools/chat.external.types";
import { DREAM_JOB_ROADMAP_DEFAULT_TARGET_YEARS } from "./chat.dream-job-roadmap.consts";
import type {
    DreamJobRoadmapCreationResult,
    DreamJobRoadmapGenerator,
    DreamJobRoadmapPersistence,
} from "./chat.dream-job-roadmap.types";

/** @deprecated Prefer DREAM_JOB_ROADMAP_DEFAULT_TARGET_YEARS; kept for tests expecting 4 stages at 2 years. */
export const DREAM_JOB_ROADMAP_STAGE_COUNT = 4;

export const createDreamJobRoadmap = async (params: {
    readonly generator: DreamJobRoadmapGenerator;
    readonly persistence: DreamJobRoadmapPersistence;
    readonly userId: string;
    readonly dreamJob: string;
    readonly targetYears?: number;
    readonly createGeneratedAt?: () => Date;
}): Promise<DreamJobRoadmapCreationResult> => {
    const createGeneratedAt = params.createGeneratedAt ?? (() => new Date());
    const targetYears = params.targetYears ?? DREAM_JOB_ROADMAP_DEFAULT_TARGET_YEARS;
    const generated = await params.generator
        .generate(params.userId, params.dreamJob, targetYears)
        .catch(() => null);

    if (generated === null) {
        return { created: false, reason: "generation_failed" };
    }

    if (generated.stages.length < 2) {
        return { created: false, reason: "invalid_stage_count" };
    }

    const progressionMeta =
        generated.progressionMeta ??
        (generated.gapAnalysis
            ? {
                  dreamRoleCategory: params.dreamJob,
                  gapAnalysis: generated.gapAnalysis,
                  generationVersion: generated.generationVersion,
                  generationMode: generated.generationMode,
              }
            : undefined);

    const roadmapParams: CreateCareerRoadmapParams = {
        userId: params.userId,
        dreamJob: params.dreamJob,
        generatedAt: createGeneratedAt(),
        stagesToDreamJob: generated.stages.map((content, index) => ({
            jobId: index + 1,
            isDone: false,
            content,
        })),
        ...(progressionMeta ? { progressionMeta } : {}),
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
