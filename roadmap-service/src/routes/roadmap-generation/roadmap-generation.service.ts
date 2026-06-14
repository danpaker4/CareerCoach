import type { Collection } from "mongodb";
import type { TextCompletionPort } from "../../ai/ports/text-completion.types";
import type { EmbeddingPort } from "../../ai/ports/embedding.types";
import type { RoadmapExternalService } from "../external/roadmap.external.service";
import type { CareerDirectionExample } from "../knowledge/career-direction.types";
import type { RoadmapGenerationResponse } from "./roadmap-generation.types";
import {
    buildRoadmapGenerationPrompt,
    formatCareerDirectionContext,
    formatCareerPathsContext,
} from "./roadmap-generation.prompt.utils";
import { parseRoadmapGenerationResponse } from "./roadmap-generation.utils";
import { buildGapAnalysis } from "./gap-analysis.service";
import { resolveUserStartingPoint } from "./user-starting-point.utils";
import type { UserCareerContext } from "./gap-analysis.types";
import { resolveStageCountFromTargetYears, formatTargetTimelineLabel } from "./roadmap-stage-count.utils";

type CareerDirectionProjection = Pick<
    CareerDirectionExample,
    "directionName" | "relatedSkills" | "exampleTasks" | "exampleRoles"
>;

const formatMarketContext = (market: Awaited<ReturnType<RoadmapExternalService["getMarketRequirements"]>>): string => {
    if (!market) return "No structured market requirements available.";
    return [
        `Role category: ${market.roleCategory}`,
        `Common skills: ${market.commonSkills.join(", ")}`,
        `Responsibilities: ${market.responsibilities.join("; ")}`,
        `Leadership signals: ${market.leadershipSignals.join("; ")}`,
        `Architecture signals: ${market.architectureSignals.join("; ")}`,
        `Seniority distribution: ${JSON.stringify(market.seniorityDistribution)}`,
    ].join("\n");
};

export class RoadmapGenerationService {
    constructor(
        private readonly textCompletion: TextCompletionPort,
        private readonly externalService: RoadmapExternalService,
        private readonly directionCollection: Collection<CareerDirectionExample>,
        private readonly embedding: EmbeddingPort,
        private readonly directionVectorIndexName: string
    ) {}

    generate = async (userId: string, dreamJob: string, targetYears: number): Promise<RoadmapGenerationResponse> => {
        const stageCount = resolveStageCountFromTargetYears(targetYears);
        await this.externalService.refreshCareerKnowledge();

        const [userProfile, careerProfile, jobs, directions] = await Promise.all([
            this.externalService.readUserPublicProfile(userId).catch(() => null),
            this.externalService.readCareerProfile(userId).catch(() => null),
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

        const startingPoint = resolveUserStartingPoint(userProfile, careerProfile);
        const userContext: UserCareerContext = {
            currentJob: startingPoint.currentJob,
            currentRoleSummary: startingPoint.currentRoleSummary,
            userSkills: startingPoint.userSkills,
            demonstratedResponsibilities: startingPoint.demonstratedResponsibilities,
            roleExperienceYears: startingPoint.roleExperienceYears,
            roleExperienceLevel: startingPoint.roleExperienceLevel,
            preferredDomains: startingPoint.preferredDomains,
            senioritySignal: startingPoint.isEntryLevel ? null : startingPoint.roleExperienceLevel,
            longTermGoals: startingPoint.longTermGoals,
            isEntryLevel: startingPoint.isEntryLevel,
        };

        const market = await this.externalService.getMarketRequirements(dreamJob).catch(() => null);
        const careerPaths = await this.externalService
            .getCareerPaths(userContext.currentJob, dreamJob)
            .catch(() => []);

        const gapAnalysis = buildGapAnalysis({
            user: userContext,
            market,
            dreamJob,
        });

        const prompt = buildRoadmapGenerationPrompt({
            dreamJob,
            stageCount,
            targetYears,
            userProfile,
            careerProfile,
            gapAnalysis,
            startingPoint,
            careerDirectionContext: formatCareerDirectionContext(directions),
            careerPathsContext: formatCareerPathsContext(careerPaths),
            marketContext: formatMarketContext(market),
        });

        const rawText = await this.textCompletion.complete(prompt, {
            operation: "roadmap.generate",
            userId,
        });

        const result = parseRoadmapGenerationResponse(rawText, stageCount, dreamJob, gapAnalysis);
        return {
            ...result,
            progressionMeta: {
                ...result.progressionMeta,
                currentRoleSummary: startingPoint.currentRoleSummary,
                estimatedYearsToGoal: `Up to ${formatTargetTimelineLabel(targetYears)}`,
                ...(startingPoint.isEntryLevel
                    ? { progressionReasoning: result.progressionMeta.progressionReasoning ?? "Path designed for someone starting after high school with no prior professional experience." }
                    : {}),
            },
        };
    };

    private searchCareerDirections = async (dreamJob: string): Promise<CareerDirectionProjection[]> => {
        const vector = await this.embedding.embedCareerDirection(dreamJob);
        if (vector.length === 0) return [];
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
