import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import type { ChatFlowDeps, SendMessagePreparedContext } from "../../../chat-flow.types";
import type { Conversation } from "../../../../routes/conversation/conversation.model";
import type { SanitizedJob } from "../../../../routes/conversation/job-in-conversation.types";
import type { ConfidenceSummary } from "../../../stage-1-prepare-context/confidence/confidence.types";
import {
    CONVERSATION_MODE,
    DEFAULT_MODE_DETECTION_RESULT,
} from "../../../stage-1-prepare-context/mode-detection/conversation-mode.consts";
import { createEmptyProfileSignals } from "../../../../routes/career-profile/signals/career-profile.signals.utils";
import { checkIfNeededAddToPipeline } from "../pipeline-shortcuts";
import { runStage2Shortcuts } from "../../run-stage-2-shortcuts";

const job = (id: string, title: string, company: string): SanitizedJob => ({
    id,
    title,
    company,
    seniority: "Mid",
    description: "",
    requirements: [],
    mustKnowSkills: [],
    niceToHaveSkills: [],
    benefits: [],
    salary: null,
    location: null,
    url: "https://example.com",
});

const emptyConfidence: ConfidenceSummary = {
    skillsConfidence: 0,
    goalsConfidence: 0,
    preferencesConfidence: 0,
    roleExperienceConfidence: 0,
    domainConfidence: 0,
    searchReadinessConfidence: 0,
    discoveryConfidence: 0,
};

const cellebrite = job("cellebrite-1", "QA Engineer", "Cellebrite");
const checkPoint = job("checkpoint-1", "QA Engineer", "Check Point");

const originalFetch = globalThis.fetch;

afterEach(() => {
    globalThis.fetch = originalFetch;
});

const buildConversation = (params: {
    awaitingPipelineDecision: boolean;
    jobs: SanitizedJob[];
    focus: SanitizedJob;
}): Conversation => ({
    userId: "u1",
    messages: [],
    stageProgress: {
        currentStageIndex: 0,
        awaitingConfirmation: false,
        stageNotes: {},
    },
    onboardingFlow: {
        started: true,
        backgroundResolved: true,
        backgroundAskCount: 0,
        directionResolved: true,
        directionAskCount: 0,
        completed: true,
        background: { status: "FOUND", role: "QA" },
        initialMode: "NEAR_TERM",
    },
    jobContext: {
        lastReturnedJobs: params.jobs,
        selectedJobId: params.focus.id,
        selectedJobSnapshot: params.focus,
        lastSearchQuery: "QA",
        lastSearchIntent: "SEARCH_PLAN",
        lastSearchAt: new Date(),
        updatedAt: new Date(),
        jobRecommendationContext: {
            selectedJobId: params.focus.id,
            selectedJob: params.focus,
            recommendedJobIds: params.jobs.map((item) => item.id),
            rejectedJobIds: [],
            acceptedJobIds: [],
            lastRecommendationAt: new Date(),
            awaitingPipelineDecision: params.awaitingPipelineDecision,
        },
    },
    createdAt: new Date(),
    updatedAt: new Date(),
});

const buildCtx = (
    message: string,
    conversation: Conversation,
    modeOverrides: Partial<typeof DEFAULT_MODE_DETECTION_RESULT> = {},
): SendMessagePreparedContext => ({
    userId: "u1",
    conversationId: "c1",
    normalizedMessage: message,
    profile: undefined,
    userAchievements: [],
    userAccountContext: "",
    conversationAfterUserMessage: conversation,
    userCareerProfile: {
        userId: "u1",
        ...createEmptyProfileSignals(),
        salaryExpectation: null,
        locationPreference: null,
        remotePreference: null,
        senioritySignal: null,
        uncertaintyLevel: 0,
        profileSummaryText: "",
        profileSummaryEmbedding: [],
        createdAt: new Date(),
        updatedAt: new Date(),
    },
    userRoleExperience: [],
    confidenceSummary: emptyConfidence,
    followUpIntent: { isFollowUp: false, requestedField: null, isExplicitNewSearch: false },
    modeDetection: {
        ...DEFAULT_MODE_DETECTION_RESULT,
        mode: CONVERSATION_MODE.NEAR_TERM,
        shouldSearchJobs: true,
        isReady: true,
        readinessScore: 100,
        ...modeOverrides,
    },
});

const buildDeps = (params: {
    completeJson: string;
    appended: string[];
    searchCalled: { value: boolean };
}): ChatFlowDeps => {
    globalThis.fetch = (async () =>
        new Response(null, { status: 201 })) as typeof fetch;

    return {
        conversationService: {
            appendAssistantMessage: async (_userId: string, _conversationId: string, reply: string) => {
                params.appended.push(reply);
            },
            saveJobContext: async () => undefined,
            updateDreamJobFlow: async () => undefined,
        } as unknown as ChatFlowDeps["conversationService"],
        externalService: {
            searchJobsByPlan: async () => {
                params.searchCalled.value = true;
                return [];
            },
        } as unknown as ChatFlowDeps["externalService"],
        profileService: {} as ChatFlowDeps["profileService"],
        textCompletion: {
            complete: async () => params.completeJson,
        },
        jobServiceBaseUrl: "http://job-service.test",
        dreamJobRoadmapCreator: {
            create: async () => ({ created: false as const, reason: "generation_failed" as const }),
        },
        suggestDirections: async () => [],
    };
};

describe("checkIfNeededAddToPipeline", () => {
    it("adds Check Point when the LLM pick returns its jobId, not the focus Cellebrite job", async () => {
        const appended: string[] = [];
        const searchCalled = { value: false };
        const deps = buildDeps({
            completeJson: '{"jobId":"checkpoint-1","confidence":"high"}',
            appended,
            searchCalled,
        });
        const conversation = buildConversation({
            awaitingPipelineDecision: true,
            jobs: [cellebrite, checkPoint],
            focus: cellebrite,
        });
        const response = await checkIfNeededAddToPipeline(
            deps,
            buildCtx("add to my pipeline the qa engineer in checkpoint", conversation),
        );

        assert.ok(response);
        assert.match(response?.reply ?? "", /Check Point/i);
        assert.doesNotMatch(response?.reply ?? "", /Cellebrite/i);
        assert.equal(searchCalled.value, false);
    });

    it("asks which job when the LLM cannot pick, and does not default to the focus job", async () => {
        const appended: string[] = [];
        const searchCalled = { value: false };
        const deps = buildDeps({
            completeJson: '{"jobId":null,"confidence":"low"}',
            appended,
            searchCalled,
        });
        const conversation = buildConversation({
            awaitingPipelineDecision: true,
            jobs: [cellebrite, checkPoint],
            focus: cellebrite,
        });
        const response = await checkIfNeededAddToPipeline(
            deps,
            buildCtx("add the qa engineer", conversation),
        );

        assert.ok(response);
        assert.match(response?.reply ?? "", /Which job do you mean/i);
        assert.doesNotMatch(response?.reply ?? "", /Done — I added/i);
        assert.equal(searchCalled.value, false);
    });

    it("accepts a single-job list without needing an LLM company match", async () => {
        const appended: string[] = [];
        const searchCalled = { value: false };
        const deps = buildDeps({
            completeJson: '{"jobId":null,"confidence":"low"}',
            appended,
            searchCalled,
        });
        const conversation = buildConversation({
            awaitingPipelineDecision: true,
            jobs: [checkPoint],
            focus: checkPoint,
        });
        const response = await checkIfNeededAddToPipeline(
            deps,
            buildCtx("add to my pipeline", conversation),
        );

        assert.ok(response);
        assert.match(response?.reply ?? "", /Check Point/i);
    });

    it("still adds another shortlist job after awaitingPipelineDecision was cleared", async () => {
        const intel = job("intel-1", "QA Engineer", "Intel");
        const appended: string[] = [];
        const searchCalled = { value: false };
        const deps = buildDeps({
            completeJson: '{"jobId":"checkpoint-1","confidence":"high"}',
            appended,
            searchCalled,
        });
        const conversation = buildConversation({
            awaitingPipelineDecision: false,
            jobs: [intel, checkPoint, cellebrite],
            focus: intel,
        });
        const response = await checkIfNeededAddToPipeline(
            deps,
            buildCtx("also add to me the qa engineer in check point", conversation),
        );

        assert.ok(response);
        assert.match(response?.reply ?? "", /Check Point/i);
        assert.doesNotMatch(response?.reply ?? "", /Intel/i);
        assert.equal(searchCalled.value, false);
    });

    it("does not treat a bare yes as an add once awaitingPipelineDecision is cleared", async () => {
        const appended: string[] = [];
        const searchCalled = { value: false };
        const deps = buildDeps({
            completeJson: '{"jobId":"cellebrite-1","confidence":"high"}',
            appended,
            searchCalled,
        });
        const conversation = buildConversation({
            awaitingPipelineDecision: false,
            jobs: [cellebrite, checkPoint],
            focus: cellebrite,
        });
        const response = await checkIfNeededAddToPipeline(
            deps,
            buildCtx("yes", conversation),
        );

        assert.equal(response, null);
    });
});

describe("runStage2Shortcuts pipeline ordering", () => {
    it("handles add-to-pipeline before near-term search when awaiting a pipeline decision", async () => {
        const appended: string[] = [];
        const searchCalled = { value: false };
        const deps = buildDeps({
            completeJson: '{"jobId":"checkpoint-1","confidence":"high"}',
            appended,
            searchCalled,
        });
        const conversation = buildConversation({
            awaitingPipelineDecision: true,
            jobs: [cellebrite, checkPoint],
            focus: cellebrite,
        });
        const response = await runStage2Shortcuts(
            deps,
            buildCtx(
                "i would like to add to my pipeline the job in qa engineer in check point",
                conversation,
                { shouldSearchJobs: true, mode: CONVERSATION_MODE.NEAR_TERM },
            ),
        );

        assert.ok(response);
        assert.equal(searchCalled.value, false);
        assert.match(response?.reply ?? "", /Check Point/i);
    });

    it("handles a follow-up add from the shortlist before near-term search", async () => {
        const intel = job("intel-1", "QA Engineer", "Intel");
        const appended: string[] = [];
        const searchCalled = { value: false };
        const deps = buildDeps({
            completeJson: '{"jobId":"checkpoint-1","confidence":"high"}',
            appended,
            searchCalled,
        });
        const conversation = buildConversation({
            awaitingPipelineDecision: false,
            jobs: [intel, checkPoint, cellebrite],
            focus: intel,
        });
        const response = await runStage2Shortcuts(
            deps,
            buildCtx(
                "also add to me the qa engineer in check point",
                conversation,
                { shouldSearchJobs: true, mode: CONVERSATION_MODE.NEAR_TERM },
            ),
        );

        assert.ok(response);
        assert.equal(searchCalled.value, false);
        assert.match(response?.reply ?? "", /Check Point/i);
    });
});
