import type { Collection } from "mongodb";
import type { TextCompletionPort } from "../../ai/ports/text-completion.types";
import type { EmbeddingPort } from "../../ai/ports/embedding.types";
import type { CareerPathSummary, RoadmapExternalService } from "../external/roadmap.external.service";
import type { CareerDirectionExample } from "../knowledge/career-direction.types";
import type { RoadmapFeatureFlags } from "./feature-flags";
import type { RoadmapGenerationResponse } from "./roadmap-generation.types";
import type { RoadmapEvalFixtureRequestBody } from "./roadmap-generation.fixture.types";
import { resolveUserStartingPoint } from "./user-starting-point.utils";
import type { UserCareerContext } from "./gap-analysis.types";
import { buildRoadmapPipeline } from "./roadmap-pipeline";
import { applyRoadmapPolish } from "./polish/roadmap-polish.service";
import { mapDeterministicStageToGeneratedContent } from "./deterministic-stage-mapper";
import { withSpan } from "../../observability/tracing";

type CareerDirectionProjection = Pick<
    CareerDirectionExample,
    "directionName" | "relatedSkills" | "exampleTasks" | "exampleRoles"
>;

export class RoadmapGenerationService {
    constructor(
        private readonly textCompletion: TextCompletionPort,
        private readonly externalService: RoadmapExternalService,
        private readonly directionCollection: Collection<CareerDirectionExample>,
        private readonly embedding: EmbeddingPort,
        private readonly directionVectorIndexName: string,
        private readonly featureFlags: RoadmapFeatureFlags
    ) {}

    generate = async (
        userId: string,
        dreamJob: string,
        targetYears: number,
        availableHoursPerWeek?: number
    ): Promise<RoadmapGenerationResponse> => {
        return withSpan("roadmap.generate", { "roadmap.target_years": targetYears }, async (span) => {
            span.setAttribute("roadmap.deterministic", this.featureFlags.deterministicCoreEnabled);
            await this.externalService.refreshCareerKnowledge();

            const context = await withSpan("roadmap.generate.context", {}, async () => {
                const [userProfile, careerProfile, directions] = await Promise.all([
                    this.externalService.readUserPublicProfile(userId).catch(() => null),
                    this.externalService.readCareerProfile(userId).catch(() => null),
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

                return { startingPoint, userContext, market, careerPaths, directions };
            });

            const { response, deterministicStages } = buildRoadmapPipeline({
                dreamJob,
                targetYears,
                availableHoursPerWeek,
                userContext: context.userContext,
                startingPoint: context.startingPoint,
                market: context.market,
                careerPaths: context.careerPaths,
                directionSkills: context.directions.flatMap((direction) => direction.relatedSkills).slice(0, 20),
                featureFlags: this.featureFlags,
            });

            if (!this.featureFlags.aiPolishEnabled) {
                span.setAttribute("roadmap.generation_mode", response.generationMode ?? "deterministic");
                span.setAttribute("roadmap.stage_count", response.stages.length);
                return response;
            }

            const polishResult = await withSpan("roadmap.generate.ai_polish", {}, async () =>
                applyRoadmapPolish({
                    textCompletion: this.textCompletion,
                    userId,
                    dreamJob,
                    stages: deterministicStages,
                })
            );
            const generationMode = polishResult.polished ? "deterministic-polished" : "deterministic";
            const stages = polishResult.stages.map(mapDeterministicStageToGeneratedContent);
            span.setAttribute("roadmap.generation_mode", generationMode);
            span.setAttribute("roadmap.stage_count", stages.length);
            return {
                ...response,
                stages,
                generationMode,
                progressionMeta: {
                    ...response.progressionMeta,
                    generationMode,
                },
            };
        });
    };

    generateFromFixture = (fixture: RoadmapEvalFixtureRequestBody): RoadmapGenerationResponse => {
        const starting = fixture.startingPoint;
        const userContext: UserCareerContext = {
            currentJob: starting.currentJob,
            currentRoleSummary: starting.currentRoleSummary ?? starting.currentJob,
            userSkills: starting.userSkills ?? [],
            demonstratedResponsibilities: starting.demonstratedResponsibilities ?? [],
            roleExperienceYears: starting.roleExperienceYears ?? 0,
            roleExperienceLevel: starting.roleExperienceLevel ?? (starting.isEntryLevel ? "entry" : "mid"),
            preferredDomains: starting.preferredDomains ?? [],
            senioritySignal: starting.isEntryLevel ? null : starting.roleExperienceLevel ?? "mid",
            longTermGoals: starting.longTermGoals ?? [],
            isEntryLevel: starting.isEntryLevel,
        };

        const careerPaths: CareerPathSummary[] = [];
        return buildRoadmapPipeline({
            dreamJob: fixture.dreamJob.trim(),
            targetYears: fixture.targetYears,
            availableHoursPerWeek: fixture.availableHoursPerWeek,
            userContext,
            startingPoint: {
                currentRoleSummary: userContext.currentRoleSummary,
                isEntryLevel: userContext.isEntryLevel === true,
            },
            market: fixture.market ?? null,
            careerPaths,
            directionSkills: fixture.pathSkills ?? [],
            featureFlags: {
                ...this.featureFlags,
                aiPolishEnabled: false,
            },
            disablePolish: true,
        }).response;
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
