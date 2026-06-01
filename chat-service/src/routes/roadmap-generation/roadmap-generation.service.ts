import type { Collection } from "mongodb";
import type { TextCompletionPort } from "../../ai/ports/text-completion.types";
import type { EmbeddingPort } from "../../ai/ports/embedding.types";
import type { ChatExternalService } from "../external-chat/chat.external.service";
import type { CareerDirectionExample } from "../chat/knowledge/career-knowledge.types";
import type { RoadmapGenerationResponse } from "./roadmap-generation.types";
import {
    buildRoadmapGenerationPrompt,
    formatSkillGapContext,
    formatCareerDirectionContext,
} from "./roadmap-generation.prompt.utils";
import { parseRoadmapGenerationResponse } from "./roadmap-generation.utils";

type CareerDirectionProjection = Pick<
    CareerDirectionExample,
    "directionName" | "relatedSkills" | "exampleTasks" | "exampleRoles"
>;

export class RoadmapGenerationService {
    constructor(
        private readonly textCompletion: TextCompletionPort,
        private readonly externalService: ChatExternalService,
        private readonly directionCollection: Collection<CareerDirectionExample>,
        private readonly embedding: EmbeddingPort,
        private readonly directionVectorIndexName: string
    ) {}

    generate = async (
        userId: string,
        dreamJob: string,
        stageCount: number
    ): Promise<RoadmapGenerationResponse> => {
        const [userProfile, jobs, directions] = await Promise.all([
            this.externalService.readUserPublicProfile(userId).catch(() => null),
            this.externalService
                .searchJobs({
                    skills: [],
                    interests: [],
                    experienceLevel: "",
                    keywords: [dreamJob],
                })
                .catch(() => []),
            this.searchCareerDirections(dreamJob).catch(() => []),
        ]);

        const userSkills = this.extractUserSkills(userProfile);
        const jobRequirements = jobs.flatMap((j) => j.requirements);
        const mustKnowSkills = jobs.flatMap((j) => j.mustKnowSkills);

        const skillGapContext = formatSkillGapContext(userSkills, jobRequirements, mustKnowSkills);
        const careerDirectionContext = formatCareerDirectionContext(directions);

        const prompt = buildRoadmapGenerationPrompt({
            dreamJob,
            stageCount,
            userProfile,
            skillGapContext,
            careerDirectionContext,
        });

        const rawText = await this.textCompletion.complete(prompt, {
            operation: "roadmap.generate",
            userId,
        });

        return parseRoadmapGenerationResponse(rawText, stageCount);
    };

    private extractUserSkills = (profile: Record<string, unknown> | null): string[] => {
        if (!profile) {
            return [];
        }
        const skillKeys = ["technologies", "knownSkills", "githubSkills", "interests"];
        const merged = skillKeys.flatMap((key) => {
            const val = profile[key];
            return Array.isArray(val)
                ? val.filter((s): s is string => typeof s === "string")
                : [];
        });
        return [...new Set(merged)];
    };

    private searchCareerDirections = async (
        dreamJob: string
    ): Promise<CareerDirectionProjection[]> => {
        const vector = await this.embedding.embedCareerDirection(dreamJob);
        if (vector.length === 0) {
            return [];
        }
        const results = await this.directionCollection
            .aggregate([
                {
                    $vectorSearch: {
                        index: this.directionVectorIndexName,
                        path: "embedding",
                        queryVector: vector,
                        numCandidates: 24,
                        limit: 3,
                    },
                },
                {
                    $project: {
                        _id: 0,
                        directionName: 1,
                        relatedSkills: 1,
                        exampleTasks: 1,
                        exampleRoles: 1,
                    },
                },
            ])
            .toArray()
            .catch(() => []);
        return results as CareerDirectionProjection[];
    };
}
