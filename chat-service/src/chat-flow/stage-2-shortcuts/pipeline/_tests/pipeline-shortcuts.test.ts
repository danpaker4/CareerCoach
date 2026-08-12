import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import type { ChatFlowDeps, SendMessagePreparedContext } from "../../../chat-flow.types";
import type { Conversation } from "../../../../routes/conversation/conversation.model";
import type { ConversationJobContext, SanitizedJob } from "../../../../routes/conversation/job-in-conversation.types";
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
    followUpOverrides: Partial<SendMessagePreparedContext["followUpIntent"]> = {},
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
    followUpIntent: { isFollowUp: false, requestedField: null, isExplicitNewSearch: false, ...followUpOverrides },
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
    savedJobContexts?: ConversationJobContext[];
}): ChatFlowDeps => {
    globalThis.fetch = (async () =>
        new Response(null, { status: 201 })) as typeof fetch;

    return {
        conversationService: {
            appendAssistantMessage: async (_userId: string, _conversationId: string, reply: string) => {
                params.appended.push(reply);
            },
            saveJobContext: async (_userId: string, _conversationId: string, jobContext: ConversationJobContext) => {
                params.savedJobContexts?.push(jobContext);
            },
            setSelectedJob: async () => undefined,
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

    it("adds an offered job to wanted-job alerts for wanted-job and wishlist requests", async () => {
        const appended: string[] = [];
        const searchCalled = { value: false };
        const deps = buildDeps({
            completeJson: '{"jobId":"cellebrite-1","confidence":"high"}',
            appended,
            searchCalled,
        });
        const wantedJobRequests: unknown[] = [];
        globalThis.fetch = (async (input, init) => {
            if (String(input).endsWith("/wanted-jobs")) {
                wantedJobRequests.push(JSON.parse(String(init?.body)) as unknown);
                return Response.json({ createdAt: new Date().toISOString() }, { status: 201 });
            }
            return new Response(null, { status: 409 });
        }) as typeof fetch;
        const conversation = buildConversation({
            awaitingPipelineDecision: true,
            jobs: [cellebrite],
            focus: cellebrite,
        });

        const responses = await Promise.all([
            "great add to my wanted job",
            "add this also to my wishlist",
        ].map((message) => checkIfNeededAddToPipeline(deps, buildCtx(message, conversation))));

        assert.ok(responses.every((response) => response !== null));
        assert.equal(wantedJobRequests.length, 2);
        assert.equal((wantedJobRequests[0] as { jobTitle: string }).jobTitle, cellebrite.title);
        assert.ok(responses.every((response) => /alert/i.test(response?.reply ?? "")));
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

    it("adds every shortlisted job when the user asks to add all five to their wishlist", async () => {
        const displayedJobs = [
            job("job-1", "Frontend Developer", "Alpha"),
            job("job-2", "Backend Developer", "Beta"),
            job("job-3", "Full-Stack Developer", "Gamma"),
            job("job-4", "Software Engineer", "Delta"),
            job("job-5", "Lead Full-Stack Developer", "Synergy Tech"),
        ];
        const undisplayedJobs = [
            job("job-6", "Mobile Developer", "Zeta"),
            job("job-7", "Platform Engineer", "Eta"),
            job("job-8", "DevOps Engineer", "Theta"),
            job("job-9", "Data Engineer", "Iota"),
            job("job-10", "Security Engineer", "Kappa"),
        ];
        const jobs = [...displayedJobs, ...undisplayedJobs];
        const appended: string[] = [];
        const searchCalled = { value: false };
        const deps = buildDeps({
            completeJson: '{"jobId":"job-5","confidence":"high"}',
            appended,
            searchCalled,
        });
        const pipelineRequests: unknown[] = [];
        const alertRequests: unknown[] = [];
        globalThis.fetch = (async (input, init) => {
            const requestBody = JSON.parse(String(init?.body)) as unknown;
            const url = String(input);
            if (url.endsWith("/wanted-jobs")) {
                alertRequests.push(requestBody);
                return Response.json({ createdAt: new Date().toISOString() }, { status: 201 });
            }
            pipelineRequests.push(requestBody);
            return new Response(null, { status: 201 });
        }) as typeof fetch;
        const conversation = buildConversation({
            awaitingPipelineDecision: true,
            jobs,
            focus: displayedJobs[0] ?? cellebrite,
        });
        conversation.messages = [{
            role: "assistant",
            content: "Here are five roles",
            timestamp: new Date(),
            attachedJobs: displayedJobs.map((displayedJob) => ({
                jobId: displayedJob.id,
                jobTitle: displayedJob.title,
                url: displayedJob.url,
                seniority: displayedJob.seniority,
                description: displayedJob.description,
                company: displayedJob.company,
                salary: displayedJob.salary ?? 0,
            })),
        }];

        const response = await checkIfNeededAddToPipeline(
            deps,
            buildCtx("add to my wishlist all the five", conversation),
        );

        assert.equal(pipelineRequests.length, 5);
        assert.deepEqual(
            pipelineRequests.map((request) => (request as { description: string }).description),
            displayedJobs.map(({ title, company }) => `${title} at ${company}`),
        );
        assert.equal(alertRequests.length, 5);
        assert.deepEqual(
            alertRequests.map((request) => (request as { jobTitle: string }).jobTitle),
            displayedJobs.map(({ title }) => title),
        );
        assert.match(response?.reply ?? "", /added all 5 roles to your pipeline wishlist/i);
        assert.match(response?.reply ?? "", /alerts? (?:are|is) active/i);
        assert.doesNotMatch(response?.reply ?? "", /added the Lead Full-Stack Developer role/i);
    });

    it("adds both displayed jobs when the user asks to add this two to their pipeline", async () => {
        const displayedJobs = [
            job("job-1", "Software Developer", "CyberArk"),
            job("job-2", "Rust Software Developer", "YO IT Consulting"),
        ];
        const appended: string[] = [];
        const searchCalled = { value: false };
        const deps = buildDeps({
            completeJson: '{"jobId":"job-1","confidence":"high"}',
            appended,
            searchCalled,
        });
        const pipelineRequests: unknown[] = [];
        globalThis.fetch = (async (_input, init) => {
            pipelineRequests.push(JSON.parse(String(init?.body)) as unknown);
            return new Response(null, { status: 201 });
        }) as typeof fetch;
        const conversation = buildConversation({
            awaitingPipelineDecision: true,
            jobs: displayedJobs,
            focus: displayedJobs[0] ?? cellebrite,
        });
        conversation.messages = [{
            role: "assistant",
            content: "Here are the two roles I found",
            timestamp: new Date(),
            attachedJobs: displayedJobs.map((displayedJob) => ({
                jobId: displayedJob.id,
                jobTitle: displayedJob.title,
                url: displayedJob.url,
                seniority: displayedJob.seniority,
                description: displayedJob.description,
                company: displayedJob.company,
                salary: displayedJob.salary ?? 0,
            })),
        }];

        const response = await checkIfNeededAddToPipeline(
            deps,
            buildCtx("great add this two to my pipeline", conversation),
        );

        assert.equal(pipelineRequests.length, 2);
        assert.deepEqual(
            pipelineRequests.map((request) => (request as { description: string }).description),
            displayedJobs.map(({ title, company }) => `${title} at ${company}`),
        );
        assert.match(response?.reply ?? "", /added (?:both|all 2) roles/i);
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
        const recommendation = conversation.jobContext?.jobRecommendationContext;
        assert.ok(recommendation);
        recommendation.acceptedJobIds = [cellebrite.id];
        const response = await checkIfNeededAddToPipeline(
            deps,
            buildCtx("yes", conversation),
        );

        assert.equal(response, null);
    });
});

describe("runStage2Shortcuts pipeline ordering", () => {
    it("ends the chat when the user is done while a pipeline decision is still pending", async () => {
        const appended: string[] = [];
        const savedJobContexts: ConversationJobContext[] = [];
        const searchCalled = { value: false };
        const deps = buildDeps({
            completeJson: '{"shouldEndConversation":false}',
            appended,
            searchCalled,
            savedJobContexts,
        });
        const conversation = buildConversation({
            awaitingPipelineDecision: true,
            jobs: [cellebrite, checkPoint],
            focus: cellebrite,
        });
        conversation.messages = [{
            role: "assistant",
            content: "Here are the roles I found. Tell me which one to add to your pipeline.",
            timestamp: new Date(),
        }];

        const response = await runStage2Shortcuts(
            deps,
            buildCtx(
                "great thats all",
                conversation,
                { shouldSearchJobs: true, mode: CONVERSATION_MODE.NEAR_TERM },
            ),
        );

        assert.ok(response);
        assert.equal(searchCalled.value, false);
        assert.match(response.reply, /you're all set/i);
        assert.equal(appended.at(-1), response.reply);
        assert.equal(savedJobContexts.at(-1)?.jobRecommendationContext?.awaitingPipelineDecision, false);
    });

    it("ends the current chat instead of searching again when the user declines further help", async () => {
        const appended: string[] = [];
        const searchCalled = { value: false };
        const deps = buildDeps({
            completeJson: '{"shouldEndConversation":true}',
            appended,
            searchCalled,
        });
        const conversation = buildConversation({
            awaitingPipelineDecision: false,
            jobs: [cellebrite, checkPoint],
            focus: cellebrite,
        });
        const recommendation = conversation.jobContext?.jobRecommendationContext;
        assert.ok(recommendation);
        recommendation.acceptedJobIds = [cellebrite.id];
        conversation.messages = [{
            role: "assistant",
            content: "Rust Software Developer is already in your pipeline. Want to explore another opportunity or prepare for interviews?",
            timestamp: new Date(),
        }];

        const response = await runStage2Shortcuts(
            deps,
            buildCtx("no thanks", conversation),
        );

        assert.ok(response);
        assert.equal(searchCalled.value, false);
        assert.match(response.reply, /you're all set/i);
        assert.match(response.reply, /available.*whenever|whenever.*available/i);
        assert.equal(appended.at(-1), response.reply);
    });

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

    it("answers salary follow-up before near-term search when jobs are already in context", async () => {
        const pixelPerfect = {
            ...job("pixel-1", "Frontend Developer (React)", "Pixel Perfect Labs"),
            salary: 28000,
        };
        const wolt = job("wolt-1", "Frontend Developer (React)", "Wolt Israel");
        const appended: string[] = [];
        const searchCalled = { value: false };
        const deps = buildDeps({
            completeJson: '{"jobId":"pixel-1","confidence":"high"}',
            appended,
            searchCalled,
        });
        const conversation = buildConversation({
            awaitingPipelineDecision: false,
            jobs: [pixelPerfect, wolt, checkPoint],
            focus: pixelPerfect,
        });
        const response = await runStage2Shortcuts(
            deps,
            buildCtx(
                "what the salary at frontend developer in pixel perfect",
                conversation,
                { shouldSearchJobs: true, mode: CONVERSATION_MODE.NEAR_TERM },
                { isFollowUp: true, requestedField: "salary", isExplicitNewSearch: false },
            ),
        );

        assert.ok(response);
        assert.equal(searchCalled.value, false);
        assert.match(response?.reply ?? "", /salary/i);
        assert.match(response?.reply ?? "", /Pixel Perfect Labs/i);
        assert.match(response?.reply ?? "", /28000/);
    });
});
