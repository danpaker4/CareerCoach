import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ChatFlowDeps, SendMessagePreparedContext } from "../../../chat-flow.types";
import type { Conversation } from "../../../../routes/conversation/conversation.model";
import type { InterviewPrepQuickHelpFlow } from "../../../../routes/conversation/conversation.types";
import { createEmptyProfileSignals } from "../../../../routes/career-profile/signals/career-profile.signals.utils";
import { DEFAULT_MODE_DETECTION_RESULT } from "../../../stage-1-prepare-context/mode-detection/conversation-mode.consts";
import { runInterviewPrepFlow } from "../interview-prep/interview-prep-flow";

const defaultFlow: InterviewPrepQuickHelpFlow = {
    kind: "interview_prep",
    step: "awaiting_ack",
    topic: "software engineering",
    questions: [
        "What is the difference between monolithic and microservices architectures, and when would you choose each?",
    ],
    index: 0,
};

const teachingFlow: InterviewPrepQuickHelpFlow = {
    kind: "interview_prep",
    step: "awaiting_teaching_check",
    topic: "QA automation",
    questions: [
        "What is a flaky test, and how does it affect a test suite?",
        "What is the purpose of regression testing?",
    ],
    index: 0,
    evaluatedQuestion: "What is a flaky test, and how does it affect a test suite?",
    modelAnswer: "A flaky test produces inconsistent results without a relevant code change.",
    improvementTip: "Define the term, then explain its impact.",
    teachingExplanation: "A flaky test changes result even when the code does not change.",
    teachingExample: "A UI test sometimes fails because a page loads slowly.",
    understandingCheck: "What do we call a test that changes result without a code change?",
    teachingAttemptCount: 1,
};

const buildContext = (
    message: string,
    quickHelpFlow: InterviewPrepQuickHelpFlow = defaultFlow,
    messages: Conversation["messages"] = [],
    profileSetup?: {
        senioritySignal?: string;
        technologies?: string[];
        roleExperience?: SendMessagePreparedContext["userRoleExperience"];
    }
): SendMessagePreparedContext => {
    const conversation: Conversation = {
        userId: "user-1",
        messages,
        quickHelpFlow,
        stageProgress: { currentStageIndex: 0, awaitingConfirmation: false, stageNotes: {} },
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    return {
        userId: "user-1",
        conversationId: "conversation-1",
        normalizedMessage: message,
        profile: undefined,
        userAchievements: [],
        userAccountContext: "",
        conversationAfterUserMessage: conversation,
        userCareerProfile: {
            userId: "user-1",
            ...createEmptyProfileSignals(),
            technologies: (profileSetup?.technologies ?? []).map((technology) => ({
                value: technology,
                confidence: 1,
                evidence: ["test"],
                source: "chat",
                updatedAt: new Date(),
            })),
            salaryExpectation: null,
            locationPreference: null,
            remotePreference: null,
            senioritySignal: profileSetup?.senioritySignal ?? null,
            uncertaintyLevel: 0,
            profileSummaryText: "",
            profileSummaryEmbedding: [],
            createdAt: new Date(),
            updatedAt: new Date(),
        },
        userRoleExperience: profileSetup?.roleExperience ?? [],
        confidenceSummary: {
            skillsConfidence: 0,
            goalsConfidence: 0,
            preferencesConfidence: 0,
            roleExperienceConfidence: 0,
            domainConfidence: 0,
            searchReadinessConfidence: 0,
            discoveryConfidence: 0,
        },
        followUpIntent: { isFollowUp: false, requestedField: null, isExplicitNewSearch: false },
        modeDetection: DEFAULT_MODE_DETECTION_RESULT,
    };
};

const buildDeps = (params: {
    completionResponses?: string[];
    completionHandler?: (prompt: string) => string;
    completionPrompts: string[];
    replies: string[];
    flowUpdates: Array<InterviewPrepQuickHelpFlow | undefined>;
}): ChatFlowDeps => ({
    conversationService: {
        appendAssistantMessage: async (_userId: string, _conversationId: string, reply: string) => {
            params.replies.push(reply);
        },
        updateQuickHelpFlow: async (_userId: string, _conversationId: string, flow: InterviewPrepQuickHelpFlow | undefined) => {
            params.flowUpdates.push(flow);
        },
    },
    textCompletion: {
        complete: async (prompt: string) => {
            params.completionPrompts.push(prompt);
            if (params.completionHandler) {
                return params.completionHandler(prompt);
            }
            return params.completionResponses?.shift() ?? "{}";
        },
    },
    externalService: {},
    profileService: {},
    jobServiceBaseUrl: "http://job-service.test",
    dreamJobRoadmapCreator: { create: async () => ({ created: false, reason: "generation_failed" }) },
    suggestDirections: async () => [],
} as unknown as ChatFlowDeps);

describe("runInterviewPrepFlow", () => {
    it("sends a challenge to the LLM instead of repeating the acknowledgement instruction", async () => {
        const completionPrompts: string[] = [];
        const replies: string[] = [];
        const flowUpdates: Array<InterviewPrepQuickHelpFlow | undefined> = [];
        const deps = buildDeps({
            completionPrompts,
            replies,
            flowUpdates,
            completionResponses: [JSON.stringify({
                outcome: "partially_correct",
                feedback: "You correctly described the structural difference; add when you would choose each.",
                followUpQuestions: ["When would you choose a monolith?"],
            })],
        });

        const response = await runInterviewPrepFlow(
            deps,
            buildContext("that's what I said", defaultFlow, [
                {
                    role: "assistant",
                    content: "What is the difference between monoliths and microservices, and when would you choose each?",
                    timestamp: new Date(),
                },
                {
                    role: "user",
                    content: "A monolith is one service, while microservices split responsibilities into smaller services.",
                    timestamp: new Date(),
                },
                {
                    role: "assistant",
                    content: "Incorrect. A monolith is one unit, while microservices are independent services.",
                    timestamp: new Date(),
                },
                { role: "user", content: "that's what I said", timestamp: new Date() },
            ]),
            false
        );

        assert.equal(completionPrompts.length, 1);
        assert.match(completionPrompts[0] ?? "", /A monolith is one service/);
        assert.match(completionPrompts[0] ?? "", /Previous feedback: Incorrect/);
        assert.doesNotMatch(response.reply, /take a moment|reply when you understand/i);
        assert.match(response.reply, /correctly described/i);
        assert.equal(replies.at(-1), response.reply);
    });

    it("uses the LLM to generate two explained options for a broad interview request", async () => {
        const completionPrompts: string[] = [];
        const replies: string[] = [];
        const flowUpdates: Array<InterviewPrepQuickHelpFlow | undefined> = [];
        const deps = buildDeps({
            completionPrompts,
            replies,
            flowUpdates,
            completionResponses: [JSON.stringify({
                action: "offer_options",
                introduction: "These are the two strongest areas for your background.",
                options: [
                    {
                        title: "Architecture tradeoffs",
                        description: "Practice explaining design choices, scaling, and operational tradeoffs.",
                    },
                    {
                        title: "Engineering collaboration",
                        description: "Practice discussing reviews, incidents, and decisions with teammates.",
                    },
                ],
            })],
        });

        const response = await runInterviewPrepFlow(
            deps,
            buildContext(
                "What should I study for a software engineer interview?",
                { kind: "interview_prep", step: "awaiting_topic" },
                [],
                {
                    senioritySignal: "mid",
                    technologies: ["TypeScript"],
                    roleExperience: [{
                        roleKey: "software-engineer",
                        displayLabel: "Software Engineer",
                        years: 5,
                        level: "mid",
                        evidence: ["test"],
                        source: "chat",
                        updatedAt: new Date(),
                    }],
                }
            ),
            false
        );

        assert.equal(completionPrompts.length, 1);
        assert.match(completionPrompts[0] ?? "", /decide whether/i);
        assert.match(completionPrompts[0] ?? "", /TypeScript/i);
        assert.match(completionPrompts[0] ?? "", /Software Engineer: 5 years/i);
        assert.match(response.reply, /Architecture tradeoffs/i);
        assert.match(response.reply, /Practice explaining design choices/i);
        assert.match(response.reply, /Engineering collaboration/i);
        assert.doesNotMatch(response.reply, /technical fundamentals/i);
        assert.equal(flowUpdates.at(-1)?.step, "awaiting_focus");
    });

    it("chooses a useful focus when the candidate delegates the choice", async () => {
        const completionPrompts: string[] = [];
        const replies: string[] = [];
        const flowUpdates: Array<InterviewPrepQuickHelpFlow | undefined> = [];
        const deps = buildDeps({
            completionPrompts,
            replies,
            flowUpdates,
            completionResponses: [
                JSON.stringify({ kind: "selected", selectedOptionId: "option-2" }),
                JSON.stringify({ questions: ["How would you compare a monolith with microservices?"] }),
            ],
        });

        const response = await runInterviewPrepFlow(
            deps,
            buildContext("you can choose", {
                kind: "interview_prep",
                step: "awaiting_focus",
                topic: "software engineering",
                baseTopic: "software engineering",
                focusOptions: [
                    {
                        id: "option-1",
                        title: "Engineering collaboration",
                        description: "Practice explaining teamwork and technical decisions.",
                    },
                    {
                        id: "option-2",
                        title: "Architecture tradeoffs",
                        description: "Practice explaining scaling and design choices.",
                    },
                ],
            }),
            false
        );

        assert.match(response.reply, /Architecture tradeoffs for software engineering/i);
        assert.doesNotMatch(response.reply, /practice you can choose/i);
        assert.match(completionPrompts[0] ?? "", /delegates the choice/i);
        assert.match(completionPrompts[1] ?? "", /Architecture tradeoffs for software engineering/i);
    });

    it("starts specific interview practice without displaying options", async () => {
        const completionPrompts: string[] = [];
        const replies: string[] = [];
        const flowUpdates: Array<InterviewPrepQuickHelpFlow | undefined> = [];
        const deps = buildDeps({
            completionPrompts,
            replies,
            flowUpdates,
            completionResponses: [
                JSON.stringify({ action: "start_practice" }),
                JSON.stringify({ questions: ["When would you use React useMemo?"] }),
            ],
        });

        const response = await runInterviewPrepFlow(
            deps,
            buildContext("React useMemo", { kind: "interview_prep", step: "awaiting_topic" }),
            false
        );

        assert.equal(completionPrompts.length, 2);
        assert.match(response.reply, /Question 1\/5: When would you use React useMemo/i);
        assert.doesNotMatch(response.reply, /which option/i);
        assert.equal(flowUpdates.at(-1)?.step, "awaiting_answer");
    });

    it("retries invalid option generation once instead of using a fixed fallback menu", async () => {
        const completionPrompts: string[] = [];
        const replies: string[] = [];
        const flowUpdates: Array<InterviewPrepQuickHelpFlow | undefined> = [];
        const deps = buildDeps({
            completionPrompts,
            replies,
            flowUpdates,
            completionResponses: [
                JSON.stringify({ action: "offer_options", options: [{ title: "Only one", description: "Invalid." }] }),
                JSON.stringify({
                    action: "offer_options",
                    introduction: "These two QA focuses fit your experience.",
                    options: [
                        { title: "Reliable automation", description: "Practice test stability and maintainable suites." },
                        { title: "Automation strategy", description: "Practice choosing coverage and tools for product risks." },
                    ],
                }),
            ],
        });

        const response = await runInterviewPrepFlow(
            deps,
            buildContext("QA automation", { kind: "interview_prep", step: "awaiting_topic" }),
            false
        );

        assert.equal(completionPrompts.length, 2);
        assert.match(response.reply, /Reliable automation/i);
        assert.match(response.reply, /Automation strategy/i);
    });

    it("asks for a specific area when both dynamic planning attempts fail", async () => {
        const completionPrompts: string[] = [];
        const replies: string[] = [];
        const flowUpdates: Array<InterviewPrepQuickHelpFlow | undefined> = [];
        const deps = buildDeps({
            completionPrompts,
            replies,
            flowUpdates,
            completionResponses: ["{}", "not json"],
        });

        const response = await runInterviewPrepFlow(
            deps,
            buildContext("data engineer", { kind: "interview_prep", step: "awaiting_topic" }),
            false
        );

        assert.equal(completionPrompts.length, 2);
        assert.match(response.reply, /which specific interview area/i);
        assert.doesNotMatch(response.reply, /system design|technical fundamentals|behavioral/i);
    });

    it("asks which dynamic option to start when the candidate selects both", async () => {
        const completionPrompts: string[] = [];
        const replies: string[] = [];
        const flowUpdates: Array<InterviewPrepQuickHelpFlow | undefined> = [];
        const focusOptions = [
            { id: "option-1", title: "API testing", description: "Practice contracts and failure cases." },
            { id: "option-2", title: "UI reliability", description: "Practice stable selectors and synchronization." },
        ] as const;
        const deps = buildDeps({
            completionPrompts,
            replies,
            flowUpdates,
            completionResponses: [JSON.stringify({ kind: "both" })],
        });

        const response = await runInterviewPrepFlow(
            deps,
            buildContext("both", {
                kind: "interview_prep",
                step: "awaiting_focus",
                topic: "QA automation",
                baseTopic: "QA automation",
                focusOptions: [...focusOptions],
            }),
            false
        );

        assert.match(response.reply, /which one should we start with/i);
        assert.match(response.reply, /API testing/i);
        assert.match(response.reply, /UI reliability/i);
        assert.equal(flowUpdates.at(-1)?.step, "awaiting_first_focus");
    });

    it("saves the second option after the LLM selects which of both options starts first", async () => {
        const completionPrompts: string[] = [];
        const replies: string[] = [];
        const flowUpdates: Array<InterviewPrepQuickHelpFlow | undefined> = [];
        const focusOptions = [
            { id: "option-1", title: "API testing", description: "Practice contracts and failure cases." },
            { id: "option-2", title: "UI reliability", description: "Practice stable selectors and synchronization." },
        ] as const;
        const deps = buildDeps({
            completionPrompts,
            replies,
            flowUpdates,
            completionResponses: [
                JSON.stringify({ kind: "selected", selectedOptionId: "option-1" }),
                JSON.stringify({ questions: ["How would you test an API contract?"] }),
            ],
        });

        await runInterviewPrepFlow(
            deps,
            buildContext("start with API testing", {
                kind: "interview_prep",
                step: "awaiting_first_focus",
                topic: "QA automation",
                baseTopic: "QA automation",
                focusOptions: [...focusOptions],
            }),
            false
        );

        assert.equal(flowUpdates.at(-1)?.step, "awaiting_answer");
        assert.equal(flowUpdates.at(-1)?.deferredFocus?.title, "UI reliability");
    });

    it("offers the saved second option after completing the first practice set", async () => {
        const completionPrompts: string[] = [];
        const replies: string[] = [];
        const flowUpdates: Array<InterviewPrepQuickHelpFlow | undefined> = [];
        const deps = buildDeps({
            completionPrompts,
            replies,
            flowUpdates,
            completionResponses: [JSON.stringify({
                outcome: "correct",
                feedback: "That clearly covers the API contract risk.",
                followUpQuestions: [],
                modelAnswer: "Explain the contract, failure cases, and observability.",
                improvementTip: "Connect each test to a risk.",
            })],
        });

        const response = await runInterviewPrepFlow(
            deps,
            buildContext("I validate the contract and cover error responses.", {
                kind: "interview_prep",
                step: "awaiting_answer",
                topic: "API testing for QA automation",
                baseTopic: "QA automation",
                questions: ["How would you test an API contract?"],
                index: 0,
                deferredFocus: {
                    id: "option-2",
                    title: "UI reliability",
                    description: "Practice stable selectors and synchronization.",
                },
            }),
            false
        );

        assert.match(response.reply, /You also chose UI reliability/i);
        assert.match(response.reply, /Would you like to practice it now/i);
        assert.equal(flowUpdates.at(-1)?.step, "awaiting_saved_focus");
    });

    it("uses the LLM to start a saved second option", async () => {
        const completionPrompts: string[] = [];
        const replies: string[] = [];
        const flowUpdates: Array<InterviewPrepQuickHelpFlow | undefined> = [];
        const deps = buildDeps({
            completionPrompts,
            replies,
            flowUpdates,
            completionResponses: [
                JSON.stringify({ kind: "selected", selectedOptionId: "option-2" }),
                JSON.stringify({ questions: ["How do you avoid brittle UI selectors?"] }),
            ],
        });

        const response = await runInterviewPrepFlow(
            deps,
            buildContext("yes, let's do it", {
                kind: "interview_prep",
                step: "awaiting_saved_focus",
                topic: "API testing for QA automation",
                baseTopic: "QA automation",
                deferredFocus: {
                    id: "option-2",
                    title: "UI reliability",
                    description: "Practice stable selectors and synchronization.",
                },
            }),
            false
        );

        assert.equal(completionPrompts.length, 2);
        assert.match(response.reply, /UI reliability for QA automation/i);
        assert.match(response.reply, /How do you avoid brittle UI selectors/i);
        assert.equal(flowUpdates.at(-1)?.deferredFocus, undefined);
    });

    it("queues multiple gaps and asks only one focused follow-up at a time", async () => {
        const completionPrompts: string[] = [];
        const replies: string[] = [];
        const flowUpdates: Array<InterviewPrepQuickHelpFlow | undefined> = [];
        const deps = buildDeps({
            completionPrompts,
            replies,
            flowUpdates,
            completionResponses: [JSON.stringify({
                outcome: "partially_correct",
                feedback: "The structural distinction is correct, but the decision criteria are missing.",
                followUpQuestions: [
                    "When would you choose a monolith?",
                    "When would microservices be worth their complexity?",
                ],
                modelAnswer: "A monolith favors simplicity; microservices favor independent scaling and deployment.",
                improvementTip: "State the operational tradeoff.",
            })],
        });

        const response = await runInterviewPrepFlow(
            deps,
            buildContext("A monolith is one service, while microservices split responsibilities.", {
                kind: "interview_prep",
                step: "awaiting_answer",
                topic: "software engineering",
                questions: ["Compare monoliths and microservices, including when to choose each."],
                index: 0,
            }),
            false
        );

        assert.match(response.reply, /when would you choose a monolith/i);
        assert.doesNotMatch(response.reply, /when would microservices be worth/i);
        assert.equal(flowUpdates.at(-1)?.activeFollowUpQuestion, "When would you choose a monolith?");
        assert.deepEqual(flowUpdates.at(-1)?.pendingFollowUpQuestions, [
            "When would microservices be worth their complexity?",
        ]);
    });

    it("responds like a supportive interviewer when the candidate gives a useful real-world example", async () => {
        const completionPrompts: string[] = [];
        const replies: string[] = [];
        const flowUpdates: Array<InterviewPrepQuickHelpFlow | undefined> = [];
        const deps = buildDeps({
            completionPrompts,
            replies,
            flowUpdates,
            completionResponses: [JSON.stringify({
                outcome: "correct",
                feedback: "Exactly — video processing is a strong example because you can scale that CPU-heavy workload independently.",
                followUpQuestions: [],
                modelAnswer: "Microservices fit workloads that need independent scaling, deployment, or fault isolation.",
                improvementTip: "Connect the example back to independent scaling.",
            })],
        });

        const response = await runInterviewPrepFlow(
            deps,
            buildContext("Video upload can take a lot of CPU, so we can scale the number of pods for that service directly.", {
                kind: "interview_prep",
                step: "awaiting_follow_up",
                topic: "software engineering",
                questions: ["Compare monoliths and microservices, including when to choose each."],
                index: 0,
                evaluatedQuestion: "Compare monoliths and microservices, including when to choose each.",
                candidateAnswer: "A large project whose parts do not rely on each other.",
                lastFeedback: "Independent services can be scaled without affecting the others.",
                activeFollowUpQuestion: "Can you give an example where that would make the system more reliable?",
                pendingFollowUpQuestions: [],
                followUpCount: 1,
            }),
            false
        );

        assert.match(response.reply, /exactly/i);
        assert.match(response.reply, /video processing/i);
        assert.doesNotMatch(response.reply, /model answer:|tip:/i);
        assert.doesNotMatch(response.reply, /I see what you're getting at|good start, but|let me clarify/i);
        assert.match(completionPrompts[0] ?? "", /warm|human|natural|supportive/i);
    });

    it("uses the LLM to enter teaching mode when the candidate does not know the answer", async () => {
        const completionPrompts: string[] = [];
        const replies: string[] = [];
        const flowUpdates: Array<InterviewPrepQuickHelpFlow | undefined> = [];
        const deps = buildDeps({
            completionPrompts,
            replies,
            flowUpdates,
            completionResponses: [JSON.stringify({
                outcome: "needs_teaching",
                feedback: "",
                followUpQuestions: [],
                teachingExplanation: "A flaky test sometimes passes and sometimes fails even when the code has not changed.",
                teachingExample: "For example, a UI test may fail only when a page loads slowly.",
                understandingCheck: "What do we call a test that changes result without a code change?",
                modelAnswer: "A flaky test produces inconsistent results without a relevant code change.",
                improvementTip: "Define the term, then explain its impact.",
            })],
        });

        const response = await runInterviewPrepFlow(
            deps,
            buildContext("I don't know what that is", {
                kind: "interview_prep",
                step: "awaiting_answer",
                topic: "QA automation",
                questions: ["What is a flaky test, and how does it affect a test suite?"],
                index: 0,
            }),
            false
        );

        assert.equal(completionPrompts.length, 1);
        assert.match(response.reply, /sometimes passes and sometimes fails/i);
        assert.match(response.reply, /for example/i);
        assert.match(response.reply, /what do we call/i);
        assert.doesNotMatch(response.reply, /didn't provide|follow-up/i);
        assert.equal(flowUpdates.at(-1)?.step, "awaiting_teaching_check");
    });

    it("gives the LLM enough context to teach when the candidate says no to a missing-detail follow-up", async () => {
        const completionPrompts: string[] = [];
        const replies: string[] = [];
        const flowUpdates: Array<InterviewPrepQuickHelpFlow | undefined> = [];
        const deps = buildDeps({
            completionPrompts,
            replies,
            flowUpdates,
            completionHandler: (prompt) => {
                const hasPriorContext =
                    prompt.includes("Previous candidate answer: monolith keeps the application together") &&
                    prompt.includes("Previous feedback: The answer is missing when to choose each architecture");
                return hasPriorContext
                    ? JSON.stringify({
                          outcome: "needs_teaching",
                          feedback: "",
                          followUpQuestions: [],
                          teachingExplanation: "Choose a monolith for simplicity and microservices for independent scaling and deployment.",
                          teachingExample: "A small product may start as a monolith; separate high-traffic domains may later become services.",
                          understandingCheck: "Which architecture would usually be simpler for a small new product?",
                          modelAnswer: "The choice depends on operational complexity and independent scaling needs.",
                          improvementTip: "Always answer the 'when would you choose it' part.",
                      })
                    : JSON.stringify({
                          outcome: "partially_correct",
                          feedback: "The answer still needs guidance on when to choose each architecture.",
                          followUpQuestions: ["When would microservices be more suitable?"],
                          modelAnswer: "Choose based on simplicity and scaling needs.",
                          improvementTip: "Explain the tradeoff.",
                      });
            },
        });

        const response = await runInterviewPrepFlow(
            deps,
            buildContext("no", {
                kind: "interview_prep",
                step: "awaiting_follow_up",
                topic: "software engineering",
                questions: ["Compare monoliths and microservices, including when to choose each."],
                index: 0,
                evaluatedQuestion: "Compare monoliths and microservices, including when to choose each.",
                candidateAnswer: "monolith keeps the application together and microservices split responsibilities",
                lastFeedback: "The answer is missing when to choose each architecture",
                activeFollowUpQuestion: "What would you add about when to choose each architecture?",
                pendingFollowUpQuestions: [],
                followUpCount: 1,
            }),
            false
        );

        assert.equal(completionPrompts.length, 1);
        assert.match(response.reply, /choose a monolith for simplicity/i);
        assert.doesNotMatch(response.reply, /follow-up/i);
        assert.equal(flowUpdates.at(-1)?.step, "awaiting_teaching_check");
    });

    it("uses the LLM to answer candidate questions and remains in teaching mode", async () => {
        const completionPrompts: string[] = [];
        const replies: string[] = [];
        const flowUpdates: Array<InterviewPrepQuickHelpFlow | undefined> = [];
        const deps = buildDeps({
            completionPrompts,
            replies,
            flowUpdates,
            completionResponses: [JSON.stringify({
                status: "asks_question",
                response: "Flaky tests are harmful because they make real failures harder to trust.",
                explanation: "",
                example: "",
                understandingCheck: "Why might a team stop trusting a flaky test suite?",
            })],
        });

        const response = await runInterviewPrepFlow(
            deps,
            buildContext("Why are flaky tests bad?", teachingFlow),
            false
        );

        assert.equal(completionPrompts.length, 1);
        assert.match(response.reply, /make real failures harder to trust/i);
        assert.match(response.reply, /why might a team stop trusting/i);
        assert.equal(flowUpdates.at(-1)?.step, "awaiting_teaching_check");
        assert.equal(flowUpdates.at(-1)?.teachingAttemptCount, 1);
    });

    it("returns to the original interview question after the LLM detects understanding", async () => {
        const completionPrompts: string[] = [];
        const replies: string[] = [];
        const flowUpdates: Array<InterviewPrepQuickHelpFlow | undefined> = [];
        const deps = buildDeps({
            completionPrompts,
            replies,
            flowUpdates,
            completionResponses: [JSON.stringify({
                status: "understood",
                response: "Yes, you have the core idea.",
                explanation: "",
                example: "",
                understandingCheck: "",
            })],
        });

        const response = await runInterviewPrepFlow(
            deps,
            buildContext("It is a test that changes result even though the code stayed the same.", teachingFlow),
            false
        );

        assert.match(response.reply, /now try the interview question again/i);
        assert.match(response.reply, /what is a flaky test/i);
        assert.equal(flowUpdates.at(-1)?.step, "awaiting_answer");
    });

    it("shares a polished answer conversationally after two unsuccessful teaching attempts", async () => {
        const completionPrompts: string[] = [];
        const replies: string[] = [];
        const flowUpdates: Array<InterviewPrepQuickHelpFlow | undefined> = [];
        const deps = buildDeps({
            completionPrompts,
            replies,
            flowUpdates,
            completionResponses: [JSON.stringify({
                status: "needs_reteaching",
                response: "This concept is still unclear, so here is the concise answer.",
                explanation: "",
                example: "",
                understandingCheck: "",
            })],
        });

        const response = await runInterviewPrepFlow(
            deps,
            buildContext("I still don't understand", { ...teachingFlow, teachingAttemptCount: 2 }),
            false
        );

        assert.match(response.reply, /how you could say it in the interview/i);
        assert.doesNotMatch(response.reply, /model answer:|tip:/i);
        assert.match(response.reply, /flaky test produces inconsistent results/i);
        assert.match(response.reply, /Question 2\/2/i);
        assert.equal(flowUpdates.at(-1)?.step, "awaiting_answer");
        assert.equal(flowUpdates.at(-1)?.index, 1);
    });
});
