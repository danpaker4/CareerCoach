import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { buildRoadmapPipeline } from "../roadmap-pipeline";
import { resolveRoadmapFeatureFlags } from "../feature-flags";
import type { MarketRequirementsContext } from "../gap-analysis.types";
import type { GeneratedStageContent, RemovedInputExample, RoadmapGenerationResponse } from "../roadmap-generation.types";

const fixturesDir = path.resolve(process.cwd(), "../evals/promptfoo/fixtures/roadmap");

type FixtureExpected = {
    minStages?: number;
    firstStageLabelIncludes?: string[];
    firstStageLabelMustNotInclude?: string[];
    mustIncludeStageLabelPatterns?: string[];
    requireHowToGetThere?: boolean;
    requireWhatYouGain?: boolean;
    maxRequiredCapabilitiesPerStage?: number;
    forbidCapabilityPatterns?: string[];
    degreeTimelineMustMentionYears?: boolean;
    mustRemoveNoise?: boolean;
    requireActionPlans?: boolean;
    allowedRecommendedRouteTypes?: Array<"job" | "internal" | "project" | "combined">;
    expectedProjectLevel?: "beginner" | "intermediate" | "advanced";
    expectedProjectHours?: number;
    requireInternalMission?: boolean;
    forbidInternalMission?: boolean;
    expectedFirstRoleFit?: "pursue-now" | "prepare-first";
    expectedInternalMoveSuitable?: boolean;
};

type FixtureFile = {
    id: string;
    request: {
        dreamJob: string;
        targetYears: number;
        availableHoursPerWeek?: number;
        startingPoint: {
            currentJob: string;
            currentRoleSummary?: string;
            userSkills?: string[];
            demonstratedResponsibilities?: string[];
            roleExperienceYears?: number;
            roleExperienceLevel?: string;
            preferredDomains?: string[];
            longTermGoals?: string[];
            isEntryLevel: boolean;
        };
        market?: MarketRequirementsContext | null;
        pathSkills?: string[];
    };
    expected: FixtureExpected;
};

const loadFixtures = (): FixtureFile[] => {
    const files = readdirSync(fixturesDir).filter((name) => name.endsWith(".json")).sort();
    return files.map((fileName) => JSON.parse(readFileSync(path.join(fixturesDir, fileName), "utf8")) as FixtureFile);
};

const runFixture = (fixture: FixtureFile): RoadmapGenerationResponse => {
    const starting = fixture.request.startingPoint;
    return buildRoadmapPipeline({
        dreamJob: fixture.request.dreamJob,
        targetYears: fixture.request.targetYears,
        availableHoursPerWeek: fixture.request.availableHoursPerWeek,
        userContext: {
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
        },
        startingPoint: {
            currentRoleSummary: starting.currentRoleSummary ?? starting.currentJob,
            isEntryLevel: starting.isEntryLevel,
        },
        market: fixture.request.market ?? null,
        careerPaths: [],
        directionSkills: fixture.request.pathSkills ?? [],
        featureFlags: resolveRoadmapFeatureFlags({
            ROADMAP_DETERMINISTIC_CORE_ENABLED: true,
            ROADMAP_AI_POLISH_ENABLED: false,
            ROADMAP_STRUCTURED_EVIDENCE_ENABLED: true,
            ROADMAP_MEASURABLE_COMPLETION_ENABLED: true,
        }),
    }).response;
};

describe("roadmap promptfoo fixtures (offline)", () => {
    for (const fixture of loadFixtures()) {
        it(`passes checks for ${fixture.id}`, () => {
            const result = runFixture(fixture);
            const expected = fixture.expected;

            assert.ok(result.stages.length >= (expected.minStages ?? (expected.requireActionPlans === true ? 1 : 2)));

            const first = result.stages[0];
            assert.ok(first);
            for (const needle of expected.firstStageLabelIncludes ?? []) {
                assert.match(first.label, new RegExp(needle, "i"));
            }
            for (const needle of expected.firstStageLabelMustNotInclude ?? []) {
                assert.doesNotMatch(first.label, new RegExp(needle, "i"));
            }
            for (const pattern of expected.mustIncludeStageLabelPatterns ?? []) {
                assert.ok(
                    result.stages.some((stage: GeneratedStageContent) => new RegExp(pattern, "i").test(stage.label)),
                    `missing stage label /${pattern}/i`
                );
            }

            if (expected.requireHowToGetThere === true) {
                assert.ok(result.stages.every((stage: GeneratedStageContent) => (stage.howToGetThere?.length ?? 0) >= 40));
            }
            if (expected.requireWhatYouGain === true) {
                assert.ok(result.stages.every((stage: GeneratedStageContent) => (stage.whatYouGain?.length ?? 0) >= 40));
            }

            const maxCaps = expected.maxRequiredCapabilitiesPerStage ?? 3;
            for (const stage of result.stages) {
                assert.ok((stage.requiredCapabilities?.length ?? 0) <= maxCaps);
                const blob = [
                    stage.label,
                    ...(stage.requiredCapabilities ?? []),
                    ...(stage.skillsToBuild ?? []),
                    ...stage.actions,
                ]
                    .join("\n")
                    .toLowerCase();
                for (const pattern of expected.forbidCapabilityPatterns ?? []) {
                    assert.doesNotMatch(blob, new RegExp(pattern, "i"));
                }
            }

            if (expected.degreeTimelineMustMentionYears === true) {
                const degreeStage = result.stages.find((stage: GeneratedStageContent) =>
                    /degree|foundation/i.test(stage.label)
                );
                assert.ok(degreeStage);
                assert.match(degreeStage.estimatedTimeframe, /year/i);
            }

            if (expected.mustRemoveNoise === true) {
                const removed = result.removedInputExamples ?? [];
                assert.ok(removed.length > 0);
                const reasons = new Set(removed.map((item: RemovedInputExample) => item.reason));
                assert.ok(
                    ["job-ad-text", "personal-trait", "years-as-skill", "company-name"].some((reason) =>
                        reasons.has(reason as RemovedInputExample["reason"])
                    )
                );
            }

            if (expected.requireActionPlans === true) {
                for (const stage of result.stages) {
                    const plan = stage.actionPlan;
                    assert.ok(plan);
                    assert.ok(plan.outcome.trim().length > 0);
                    assert.ok(plan.routes.length >= 3);
                    const recommendedRoutes = plan.routes.filter((route) => route.isRecommended);
                    assert.equal(recommendedRoutes.length, 1);
                    const recommendedRoute = recommendedRoutes[0];
                    assert.ok(recommendedRoute);
                    assert.equal(recommendedRoute.id, plan.recommendedRouteId);
                    assert.ok(recommendedRoute.completionRule.trim().length >= 20);
                    if (expected.allowedRecommendedRouteTypes) {
                        assert.ok(expected.allowedRecommendedRouteTypes.includes(recommendedRoute.type));
                    }
                    if (expected.requireInternalMission === true) assert.ok(recommendedRoute.missionOptions.length > 0);
                    if (expected.forbidInternalMission === true) assert.equal(recommendedRoute.missionOptions.length, 0);
                    assert.ok(recommendedRoute.roleOptions.length >= 3);
                    assert.ok(recommendedRoute.projectOptions.length >= 3);
                    const firstRole = recommendedRoute.roleOptions[0];
                    assert.ok(firstRole);
                    if (expected.expectedFirstRoleFit) assert.equal(firstRole.fit, expected.expectedFirstRoleFit);
                    if (expected.expectedInternalMoveSuitable !== undefined) {
                        assert.equal(firstRole.internalMoveSuitable, expected.expectedInternalMoveSuitable);
                    }
                    for (const project of recommendedRoute.projectOptions) {
                        if (expected.expectedProjectLevel) assert.equal(project.level, expected.expectedProjectLevel);
                        if (expected.expectedProjectHours) assert.equal(project.estimatedHours, expected.expectedProjectHours);
                        assert.ok(project.tasks.length >= 3);
                        assert.ok(project.deliverables.length >= 3);
                        assert.ok(project.completionChecklist.length >= 3);
                        assert.ok(project.optionalGuidance.some((item) => /confidential|public|synthetic/i.test(item)));
                    }
                    const routeIds = plan.routes.map((route) => route.id);
                    assert.equal(new Set(routeIds).size, routeIds.length);
                    for (const route of plan.routes) {
                        const recommendationIds = [
                            ...route.roleOptions.map((role) => role.id),
                            ...route.missionOptions.map((mission) => mission.id),
                            ...route.projectOptions.map((project) => project.id),
                        ];
                        assert.equal(new Set(recommendationIds).size, recommendationIds.length);
                    }
                }
            }
        });
    }
});
