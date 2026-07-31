import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { TextCompletionPort } from "../../../ai/ports/text-completion.types";
import { applyRoadmapPolish } from "../polish/roadmap-polish.service";
import type { DeterministicStage } from "../builder/deterministic-stage-builder.types";

const baseStage = (stageId: string): DeterministicStage => ({
    stageId,
    templateId: "tpl.foundations",
    label: "Build foundations",
    description: "Learn the basics",
    whyItMatters: "Needed for the role",
    progressionType: "learning",
    actions: ["Practice"],
    actionIds: ["act.generic.capability"],
    resources: [],
    resourceIds: [],
    capabilityIds: ["cap.javascript"],
    gapIds: ["gap.cap.javascript"],
    skillsToBuild: ["JavaScript"],
    responsibilitiesToGain: [],
    requiredCapabilities: ["JavaScript"],
    roleCategories: ["Engineer"],
    futureOpportunities: ["Engineer"],
    experienceAccumulation: "Build JavaScript",
    completionCriteria: [],
    timelineMeta: {
        effortHours: 10,
        hoursPerWeek: 10,
        estimatedWeeks: 1.1,
        minMonths: 1,
        maxMonths: 2,
        assumedAvailability: true,
        assumptions: [],
    },
    estimatedTimeframe: "1–2 months",
    evidence: { gapIds: [], capabilityIds: [], actionIds: [], resourceIds: [], gapsAddressed: [], transitionReasons: [], marketSignals: [] },
    reasonCodes: ["deterministic_builder"],
});

describe("roadmap polish", () => {
    it("falls back to deterministic wording when LLM is down", async () => {
        const textCompletion: TextCompletionPort = {
            complete: async () => {
                throw new Error("LLM unavailable");
            },
        };
        const stages = [baseStage("stage.1")];
        const result = await applyRoadmapPolish({
            textCompletion,
            userId: "user-1",
            dreamJob: "Engineer",
            stages,
        });
        assert.equal(result.polished, false);
        assert.ok(result.reasonCodes.includes("polish_llm_unavailable"));
        assert.equal(result.stages[0]?.label, "Build foundations");
    });

    it("rejects structural drift in polish response", async () => {
        const textCompletion: TextCompletionPort = {
            complete: async () =>
                JSON.stringify({
                    stages: [{ stageId: "wrong-id", label: "New", description: "Text" }],
                }),
        };
        const result = await applyRoadmapPolish({
            textCompletion,
            userId: "user-1",
            dreamJob: "Engineer",
            stages: [baseStage("stage.1")],
        });
        assert.equal(result.polished, false);
        assert.ok(result.reasonCodes.includes("polish_rejected_structural_drift"));
    });

    it("merges wording by stage id when valid", async () => {
        const textCompletion: TextCompletionPort = {
            complete: async () =>
                JSON.stringify({
                    stages: [
                        {
                            stageId: "stage.1",
                            label: "Polished label",
                            description: "Polished description",
                            whyItMatters: "Polished why",
                        },
                    ],
                }),
        };
        const result = await applyRoadmapPolish({
            textCompletion,
            userId: "user-1",
            dreamJob: "Engineer",
            stages: [baseStage("stage.1")],
        });
        assert.equal(result.polished, true);
        assert.equal(result.stages[0]?.label, "Polished label");
        assert.equal(result.stages[0]?.description, "Polished description");
        assert.equal(result.stages[0]?.actions[0], "Practice");
    });
});
