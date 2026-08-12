import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cleanMarketRequirementTexts } from "../cleaning/market-requirement-cleaner";
import { normalizeCapabilityText, normalizeCapabilityTexts } from "../catalog/capability-normalization";
import { computeGapScore, computeMarketImportance, computePriorityScore, computeBaseWeeks } from "../scoring/roadmap-scoring";
import { buildStructuredGapAnalysis } from "../structured/scored-gaps";
import { topologicalSortCapabilities } from "../deps/capability-dependency-graph";
import { buildDeterministicStages } from "../builder/deterministic-stage-builder";
import { rankCareerPaths } from "../path/path-ranking";
import { resolveSelectedCareerPath } from "../path/career-path-resolution";
import { resolveRoleMilestonePlan } from "../path/role-milestones";
import type { UserCareerContext } from "../gap-analysis.types";
import type { CapabilityGap } from "../structured/structured-gap.types";

describe("market requirement cleaner", () => {
    it("rejects job-ad fluff, company names, personality, and years-as-skills", () => {
        const result = cleanMarketRequirementTexts([
            "We offer a supportive environment",
            "Performance Systems Inc",
            "Eagerness to learn",
            "10+ years experience",
            "Python",
            "Bachelor's degree in Computer Science or related field",
            "This role requires a deep understanding of memory management, multithreading, and performance optimization techniques for enterprise platforms",
        ]);

        assert.ok(result.removed.some((item) => item.reason === "job-ad-text"));
        assert.ok(result.removed.some((item) => item.reason === "company-name" || item.reason === "job-ad-text"));
        assert.ok(result.removed.some((item) => item.reason === "personal-trait"));
        assert.ok(result.removed.some((item) => item.reason === "years-as-skill"));
        assert.ok(result.kept.some((item) => item.normalizedName === "Python" || item.capabilityId === "cap.python"));
        assert.ok(result.kept.some((item) => item.classification === "EDUCATION"));
        assert.ok(!result.kept.some((item) => /we offer/i.test(item.normalizedName)));
    });

    it("rejects JD duty sentences that are not real skill names", () => {
        const result = cleanMarketRequirementTexts([
            "You will develop test scripts using Selenium and Java",
            "Your work will directly impact the safety and security of our users",
            "You will be responsible for designing, developing, and maintaining large-scale systems",
            "Proven track record of delivering impactful ML solutions",
            "Python",
            "System design",
        ]);

        assert.ok(result.removed.some((item) => /you will develop/i.test(item.input) && item.reason === "job-ad-text"));
        assert.ok(result.removed.some((item) => /your work will/i.test(item.input)));
        assert.ok(result.removed.some((item) => /responsible for designing/i.test(item.input)));
        assert.ok(result.removed.some((item) => /proven track record/i.test(item.input)));
        assert.ok(result.kept.some((item) => item.capabilityId === "cap.python"));
        assert.ok(result.kept.some((item) => item.capabilityId === "cap.system.design"));
        assert.ok(!result.kept.some((item) => /you will/i.test(item.normalizedName)));
    });
});

describe("capability normalization", () => {
    it("maps aliases to stable catalog ids", () => {
        const normalized = normalizeCapabilityText("TypeScript");
        assert.equal(normalized.id, "cap.typescript");
        assert.equal(normalizeCapabilityText("ts").id, "cap.typescript");
    });

    it("maps bachelor degree phrases to credential capability", () => {
        const normalized = normalizeCapabilityText(
            "Bachelor's degree in Computer Science or related field"
        );
        assert.equal(normalized.id, "cap.credential.cs.degree");
        assert.equal(normalized.category, "credential");
    });

    it("creates dynamic ids for unknown skills", () => {
        const normalized = normalizeCapabilityText("Obscure Framework XYZ");
        assert.match(normalized.id, /^cap\.dynamic\./);
    });

    it("dedupes normalized lists", () => {
        const result = normalizeCapabilityTexts(["JavaScript", "js", "JavaScript"]);
        assert.equal(result.length, 1);
        assert.equal(result[0]?.id, "cap.javascript");
    });
});

describe("roadmap scoring", () => {
    it("computes market importance and gap priority", () => {
        const importance = computeMarketImportance({
            frequency: 2,
            requirementStrength: 1,
            recency: 1,
            sourceConfidence: 1,
        });
        assert.equal(importance, 2);
        assert.equal(computeGapScore({ requiredLevel: 3, currentLevel: 1 }), 2);
        assert.equal(
            computePriorityScore({
                gapScore: 2,
                marketImportance: 2,
                transitionRelevance: 1,
                dependencyWeight: 1,
                confidence: 1,
            }),
            4
        );
    });

    it("computes timeline weeks from effort and availability", () => {
        const weeks = computeBaseWeeks({ effortHours: 20, hoursPerWeek: 10 });
        assert.ok(weeks > 0);
    });
});

describe("structured gaps", () => {
    it("builds scored gaps from market requirements and user skills", () => {
        const user: UserCareerContext = {
            currentJob: "Junior Developer",
            currentRoleSummary: "Junior Developer",
            userSkills: ["JavaScript"],
            demonstratedResponsibilities: [],
            roleExperienceYears: 1,
            roleExperienceLevel: "junior",
            preferredDomains: [],
            senioritySignal: "junior",
            longTermGoals: [],
            isEntryLevel: false,
        };

        const structured = buildStructuredGapAnalysis({
            user,
            market: {
                roleCategory: "Senior Engineer",
                commonSkills: ["TypeScript", "React", "System design"],
                responsibilities: ["Own delivery"],
                leadershipSignals: ["Mentoring"],
                architectureSignals: ["System design"],
                seniorityDistribution: { senior: 10 },
            },
            dreamJob: "Senior Engineer",
        });

        assert.ok(structured.gaps.length > 0);
        assert.ok(structured.gaps.every((gap) => gap.gapScore > 0));
        assert.ok(structured.userCapabilities.some((capability) => capability.capabilityId === "cap.javascript"));
    });
});

describe("capability dependency graph", () => {
    it("orders dependencies before dependents", () => {
        const result = topologicalSortCapabilities([
            "cap.typescript",
            "cap.javascript",
            "cap.programming.fundamentals",
        ]);
        const fundamentals = result.ordered.indexOf("cap.programming.fundamentals");
        const javascript = result.ordered.indexOf("cap.javascript");
        const typescript = result.ordered.indexOf("cap.typescript");
        assert.ok(fundamentals < javascript);
        assert.ok(javascript < typescript);
        assert.equal(result.cycles.length, 0);
    });

    it("detects cycles", () => {
        const edges = new Map<string, readonly string[]>([
            ["a", ["b"]],
            ["b", ["a"]],
        ]);
        const result = topologicalSortCapabilities(["a", "b"], edges);
        assert.ok(result.cycles.length > 0);
    });
});

describe("path ranking", () => {
    it("falls back to direct path with reason code", () => {
        const result = rankCareerPaths({
            currentJob: "Analyst",
            dreamJob: "Product Manager",
            knownPaths: [],
        });
        assert.equal(result.selected.path.source, "direct");
        assert.ok(result.selected.reasonCodes.includes("no_intermediate_path"));
    });
});

describe("career path resolution", () => {
    it("returns intermediate roles for cybersecurity CEO targets", () => {
        const path = resolveSelectedCareerPath({
            currentJob: "Student",
            dreamJob: "CEO of cybersecurity company",
            targetYears: 8,
            isEntryLevel: true,
            hasNoSkills: true,
        });
        assert.ok(path.steps.length >= 5);
        assert.ok(path.steps.some((step) => /degree|foundation/i.test(step)));
        assert.ok(path.steps.some((step) => /security|cyber/i.test(step)));
        assert.ok(path.steps.some((step) => /ceo/i.test(step)));
    });

    it("returns architect job ladder roles instead of random junior titles", () => {
        const path = resolveSelectedCareerPath({
            currentJob: "Software Engineer",
            dreamJob: "principal architect at google",
            targetYears: 6,
            isEntryLevel: false,
            hasNoSkills: false,
            knownPathRoles: ["Junior Qa Engineer", "Junior Ux Designer"],
        });
        assert.ok(path.reasonCodes.includes("path_architecture_ic"));
        assert.ok(path.steps.some((step) => /senior|staff|principal/i.test(step)));
        assert.ok(!path.steps.some((step) => /junior qa|junior ux/i.test(step)));
    });
});

describe("role milestone stages", () => {
    it("preserves a fintech CEO target and builds flexible executive evidence milestones", () => {
        const dreamJob = "CEO of a fintech company";
        const plan = resolveRoleMilestonePlan({ dreamJob, targetYears: 10, isEntryLevel: false, hasNoSkills: false });
        assert.ok(plan);
        assert.ok(plan.reasonCodes.includes("exact_target_preserved"));
        assert.equal(plan.milestones.at(-1)?.targetRole, dreamJob);
        assert.ok(plan.milestones.some((stage) => /manage|management/i.test(stage.label)));
        assert.ok(plan.milestones.some((stage) => /finance|budget/i.test(stage.label)));

        const stages = buildDeterministicStages({
            dreamJob,
            preferredStageCount: 10,
            gaps: [],
            milestonePlan: plan,
            hoursPerWeek: 8,
            assumedAvailability: false,
            courseBudget: "mixed",
        });
        assert.ok(stages.length > 4);
        assert.ok(stages.slice(1).every((stage) => stage.prerequisiteStageIds.length > 0));
        assert.ok(stages.some((stage) => stage.resources.some((resource) => resource.url.includes("coursera.org/learn/wharton-finance"))));
        assert.ok(stages.flatMap((stage) => stage.resources).every((resource) => !resource.url.includes("google.com/search")));
    });

    it("explains degree then cyber job then team lead for zero-knowledge CEO path", () => {
        const plan = resolveRoleMilestonePlan({
            dreamJob: "CEO of cybersecurity company",
            targetYears: 10,
            isEntryLevel: true,
            hasNoSkills: true,
        });
        assert.ok(plan);
        const stages = buildDeterministicStages({
            dreamJob: "CEO of cybersecurity company",
            preferredStageCount: 8,
            gaps: [],
            milestonePlan: plan,
            hoursPerWeek: 10,
            assumedAvailability: false,
        });

        assert.ok(stages.length >= 4);
        assert.match(stages[0]!.label, /degree|foundation/i);
        assert.ok(stages[0]!.howToGetThere && /degree|bachelor|foundation/i.test(stages[0]!.howToGetThere));
        assert.ok(stages[0]!.whatYouGain && stages[0]!.whatYouGain.length > 40);
        assert.ok(stages.some((stage) => /cybersecurity professional|cybersecurity engineer|security analyst/i.test(stage.label)));
        assert.ok(stages.some((stage) => /team lead|managing/i.test(stage.label)));
        assert.ok(stages.every((stage) => (stage.howToGetThere?.length ?? 0) > 40));
        assert.ok(stages.every((stage) => (stage.whatYouGain?.length ?? 0) > 40));
    });

    it("builds jobs-plus-learning milestones for principal architect without CS degree restart", () => {
        const plan = resolveRoleMilestonePlan({
            dreamJob: "Principal Architect at Google",
            targetYears: 6,
            isEntryLevel: false,
            hasNoSkills: false,
        });
        assert.ok(plan);
        assert.ok(plan.reasonCodes.includes("architecture_ic"));
        assert.ok(plan.reasonCodes.includes("jobs_plus_learning"));
        assert.ok(plan.milestones.some((stage) => stage.progressionType === "learning"));
        assert.ok(plan.milestones.some((stage) => stage.progressionType === "experience"));
        assert.ok(plan.milestones.some((stage) => /senior software engineer|software architect/i.test(stage.label)));
        assert.ok(plan.milestones.some((stage) => /staff engineer/i.test(stage.label)));
        assert.ok(plan.milestones.some((stage) => /principal/i.test(stage.label)));
        assert.ok(!plan.milestones.some((stage) => /cs degree|computer science degree/i.test(stage.label)));

        const stages = buildDeterministicStages({
            dreamJob: "Principal Architect at Google",
            preferredStageCount: 6,
            gaps: [],
            milestonePlan: plan,
            hoursPerWeek: 10,
            assumedAvailability: false,
            measurableCompletionEnabled: true,
            structuredEvidenceEnabled: true,
        });
        assert.ok(stages.length >= 4);
        assert.ok(stages.some((stage) => stage.progressionType === "experience"));
        assert.ok(stages.some((stage) => stage.roleCategories.some((role) => /senior|staff|principal/i.test(role))));
        assert.ok(
            stages
                .filter((stage) => stage.progressionType === "learning")
                .every((stage) => stage.roleCategories.length === 0)
        );
    });
});

describe("deterministic stage builder", () => {
    it("builds stages with catalog actions and timeline meta", () => {
        const structured = buildStructuredGapAnalysis({
            user: {
                currentJob: "Student",
                currentRoleSummary: "Student",
                userSkills: [],
                demonstratedResponsibilities: [],
                roleExperienceYears: 0,
                roleExperienceLevel: "entry",
                preferredDomains: [],
                senioritySignal: null,
                longTermGoals: [],
                isEntryLevel: true,
            },
            market: {
                roleCategory: "Frontend Engineer",
                commonSkills: ["JavaScript", "React", "TypeScript"],
                responsibilities: ["Ship UI features"],
                leadershipSignals: [],
                architectureSignals: [],
                seniorityDistribution: {},
            },
            dreamJob: "Frontend Engineer",
        });

        const stages = buildDeterministicStages({
            dreamJob: "Frontend Engineer",
            preferredStageCount: 4,
            gaps: structured.gaps,
            hoursPerWeek: 10,
            assumedAvailability: false,
            measurableCompletionEnabled: true,
            structuredEvidenceEnabled: true,
        });

        assert.ok(stages.length >= 2);
        assert.ok(stages.every((stage) => stage.actions.length > 0));
        assert.ok(stages.every((stage) => stage.timelineMeta.effortHours > 0));
        assert.ok(stages.every((stage) => stage.completionCriteria.length > 0));
        assert.ok(stages.every((stage) => stage.requiredCapabilities.length <= 3));
        assert.ok(stages.every((stage) => !stage.resources.some((resource) => resource.url.length === 0)));
    });

    it("splits unrelated technical skills into focused stages instead of one Python mega-stage", () => {
        const gaps: CapabilityGap[] = [
            {
                gapId: "gap.cap.python",
                capabilityId: "cap.python",
                label: "Python",
                category: "technical",
                requiredLevel: 3,
                currentLevel: 0,
                gapScore: 3,
                marketImportance: 1,
                transitionRelevance: 1,
                dependencyWeight: 1,
                confidence: 0.9,
                priorityScore: 3.2,
                reasonCodes: ["MARKET"],
            },
            {
                gapId: "gap.cap.machine.learning",
                capabilityId: "cap.machine.learning",
                label: "Machine learning",
                category: "technical",
                requiredLevel: 3,
                currentLevel: 0,
                gapScore: 3,
                marketImportance: 1,
                transitionRelevance: 1,
                dependencyWeight: 1,
                confidence: 0.9,
                priorityScore: 3.1,
                reasonCodes: ["MARKET"],
            },
            {
                gapId: "gap.cap.cloud.basics",
                capabilityId: "cap.cloud.basics",
                label: "Cloud fundamentals",
                category: "technical",
                requiredLevel: 2,
                currentLevel: 0,
                gapScore: 2,
                marketImportance: 1,
                transitionRelevance: 1,
                dependencyWeight: 1,
                confidence: 0.9,
                priorityScore: 2.8,
                reasonCodes: ["MARKET"],
            },
            {
                gapId: "gap.cap.communication",
                capabilityId: "cap.communication",
                label: "Professional communication",
                category: "soft",
                requiredLevel: 2,
                currentLevel: 0,
                gapScore: 2,
                marketImportance: 0.8,
                transitionRelevance: 1,
                dependencyWeight: 1,
                confidence: 0.8,
                priorityScore: 2.4,
                reasonCodes: ["MARKET"],
            },
            {
                gapId: "gap.dyn.spark.kafka",
                capabilityId: "dyn.deep.knowledge.of.spark.kafka",
                label: "Deep knowledge of Spark/Kafka",
                category: "technical",
                requiredLevel: 3,
                currentLevel: 0,
                gapScore: 3,
                marketImportance: 1,
                transitionRelevance: 1,
                dependencyWeight: 1,
                confidence: 0.7,
                priorityScore: 2.9,
                reasonCodes: ["MARKET"],
            },
        ];

        const stages = buildDeterministicStages({
            dreamJob: "Principal Architect",
            preferredStageCount: 6,
            gaps,
            hoursPerWeek: 10,
            assumedAvailability: false,
            measurableCompletionEnabled: true,
            structuredEvidenceEnabled: true,
        });

        assert.ok(stages.length >= 4);
        assert.ok(stages.every((stage) => stage.requiredCapabilities.length <= 3));

        const pythonStage = stages.find((stage) => /python/i.test(stage.label));
        assert.ok(pythonStage);
        assert.ok(pythonStage.requiredCapabilities.every((cap) => !/machine learning|cloud|spark|kafka|communication/i.test(cap)));
        assert.ok(pythonStage.skillsToBuild.every((skill) => !/machine learning|cloud|spark|kafka/i.test(skill)));

        const mlStage = stages.find(
            (stage) => /machine learning|data and machine learning|spark|kafka/i.test(stage.label) ||
                stage.requiredCapabilities.some((cap) => /machine learning|spark|kafka/i.test(cap))
        );
        assert.ok(mlStage);
        assert.notEqual(mlStage.stageId, pythonStage.stageId);

        const cloudStage = stages.find(
            (stage) => /cloud/i.test(stage.label) || stage.requiredCapabilities.some((cap) => /cloud/i.test(cap))
        );
        assert.ok(cloudStage);
        assert.notEqual(cloudStage.stageId, pythonStage.stageId);

        const communicationStage = stages.find(
            (stage) =>
                /communication/i.test(stage.label) ||
                stage.requiredCapabilities.some((cap) => /communication/i.test(cap))
        );
        assert.ok(communicationStage);
        assert.notEqual(communicationStage.stageId, pythonStage.stageId);
    });

    it("uses multi-year timelines for degree credentials instead of two-week practice", () => {
        const stages = buildDeterministicStages({
            dreamJob: "Software Engineer",
            preferredStageCount: 4,
            gaps: [
                {
                    gapId: "gap.cap.credential.cs.degree",
                    capabilityId: "cap.credential.cs.degree",
                    label: "Computer science degree or equivalent",
                    category: "credential",
                    requiredLevel: 3,
                    currentLevel: 0,
                    gapScore: 3,
                    marketImportance: 1,
                    transitionRelevance: 1,
                    dependencyWeight: 1,
                    confidence: 0.8,
                    priorityScore: 3,
                    reasonCodes: ["class_EDUCATION"],
                },
            ],
            hoursPerWeek: 10,
            assumedAvailability: false,
            measurableCompletionEnabled: true,
            structuredEvidenceEnabled: true,
        });

        assert.equal(stages.length, 1);
        const stage = stages[0];
        assert.ok(stage);
        assert.ok(stage.timelineMeta.estimatedWeeks >= 156);
        assert.match(stage.estimatedTimeframe, /year/i);
        assert.ok(!stage.actions.some((action) => /practice and demonstrate bachelor/i.test(action)));
        assert.ok(!stage.skillsToBuild.includes("Computer science degree or equivalent"));
        assert.ok(stage.actions.some((action) => /bachelor|equivalent|degree/i.test(action)));
    });

    it("builds a focused experience arc for cybersecurity CEO without JD dumps", () => {
        const structured = buildStructuredGapAnalysis({
            user: {
                currentJob: "Student",
                currentRoleSummary: "Student",
                userSkills: [],
                demonstratedResponsibilities: [],
                roleExperienceYears: 0,
                roleExperienceLevel: "entry",
                preferredDomains: [],
                senioritySignal: null,
                longTermGoals: [],
                isEntryLevel: true,
            },
            market: {
                roleCategory: "CEO",
                commonSkills: [
                    "Bachelor's degree in Computer Science or related field",
                    "Cybersecurity",
                    "Leadership",
                    "We offer hands-on experience with cutting-edge systems",
                    "Eagerness to learn",
                    "10+ years experience",
                    "Performance Systems Inc",
                ],
                responsibilities: ["Set company strategy"],
                leadershipSignals: ["Lead executives"],
                architectureSignals: [],
                seniorityDistribution: { executive: 5 },
            },
            dreamJob: "CEO of cybersecurity company",
        });

        assert.ok(structured.removedInputs.length > 0);
        assert.ok(
            structured.removedInputs.some((item) =>
                ["job-ad-text", "personal-trait", "years-as-skill", "company-name"].includes(item.reason)
            )
        );

        const path = resolveSelectedCareerPath({
            currentJob: "Student",
            dreamJob: "CEO of cybersecurity company",
            targetYears: 8,
        });

        const stages = buildDeterministicStages({
            dreamJob: "CEO of cybersecurity company",
            preferredStageCount: 8,
            gaps: structured.gaps,
            preparedForRoles: path.steps,
            hoursPerWeek: 10,
            assumedAvailability: false,
            measurableCompletionEnabled: true,
            structuredEvidenceEnabled: true,
        });

        assert.ok(stages.length >= 3);
        assert.ok(stages.length <= 7);
        const prepareCount = stages.filter((stage) => /^Prepare for /i.test(stage.label) || /^Package evidence/i.test(stage.label)).length;
        assert.ok(prepareCount <= 1);
        assert.ok(stages.every((stage) => stage.requiredCapabilities.length <= 3));
        assert.ok(stages.every((stage) => stage.actions.every((action) => !/we offer|eagerness|10\+ years/i.test(action))));
        assert.ok(stages.every((stage) => stage.requiredCapabilities.every((cap) => !/we offer|eagerness|10\+ years|inc\b/i.test(cap))));
        assert.ok(structured.gaps.some((gap) => gap.capabilityId === "cap.cybersecurity"));
        assert.ok(structured.gaps.some((gap) => gap.capabilityId === "cap.executive.leadership"));
        const labels = new Set(stages.map((stage) => stage.label));
        assert.equal(labels.size, stages.length);
    });
});
