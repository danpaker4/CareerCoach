import type { CreateCareerRoadmapParams } from "../../external-chat/chat.external.types";
import type {
    DreamJobRoadmapCreationResult,
    DreamJobRoadmapGenerator,
    DreamJobRoadmapPersistence,
} from "./chat.dream-job-roadmap.types";

export const DREAM_JOB_ROADMAP_STAGE_COUNT = 4;

export class DreamJobRoadmapService {
    constructor(
        private readonly generator: DreamJobRoadmapGenerator,
        private readonly persistence: DreamJobRoadmapPersistence,
        private readonly createGeneratedAt: () => Date = () => new Date()
    ) {}

    create = async (userId: string, dreamJob: string): Promise<DreamJobRoadmapCreationResult> => {
        const generated = await this.generator
            .generate(userId, dreamJob, DREAM_JOB_ROADMAP_STAGE_COUNT)
            .catch(() => null);

        if (generated === null) {
            return { created: false, reason: "generation_failed" };
        }

        if (generated.stages.length !== DREAM_JOB_ROADMAP_STAGE_COUNT) {
            return { created: false, reason: "invalid_stage_count" };
        }

        const params: CreateCareerRoadmapParams = {
            userId,
            dreamJob,
            generatedAt: this.createGeneratedAt(),
            stagesToDreamJob: generated.stages.map((content, index) => ({
                jobId: index + 1,
                isDone: false,
                content,
            })),
        };

        const created = await this.persistence.createCareerRoadmap(params).catch(() => false);
        return created ? { created: true } : { created: false, reason: "persistence_failed" };
    };
}
