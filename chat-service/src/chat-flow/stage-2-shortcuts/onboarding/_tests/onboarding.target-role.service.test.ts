import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Conversation } from "../../../../routes/conversation/conversation.model";
import type { TextCompletionPort } from "../../../../litellm/text-completion/text-completion.types";
import {
    parseTargetRoleDecision,
    parseTargetRoleGroundingDecision,
    parseTargetRoleOptionsReviewDecision,
    parseTargetRoleSuggestionReviewDecision,
} from "../onboarding.target-role.llm.utils";
import { buildTargetRoleDecisionPrompt } from "../onboarding.target-role.prompt.utils";
import { resolveTargetRoleDecision } from "../onboarding.target-role.service";
import { formatTargetRoleOptionsReply } from "../onboarding.target-role.utils";
import { ONBOARDING_DIRECTION_REASK_REPLY } from "../onboarding.types";

const createDifferentRoleConversation = (latestUserMessage = "product manager"): Conversation => ({
    userId: "user-1",
    messages: [
        { role: "user", content: "i am looking for a job now", timestamp: new Date(0) },
        {
            role: "assistant",
            content: "Are you looking for the same role (software developer), or do you want to move into a different role?",
            timestamp: new Date(1),
        },
        { role: "user", content: "different role", timestamp: new Date(2) },
        {
            role: "assistant",
            content: "What role or kind of work would you like to move into?",
            timestamp: new Date(3),
        },
        { role: "user", content: latestUserMessage, timestamp: new Date(4) },
    ],
    stageProgress: {
        currentStageIndex: 0,
        awaitingConfirmation: false,
        stageNotes: {},
    },
    onboardingFlow: {
        started: true,
        backgroundResolved: true,
        backgroundAskCount: 1,
        directionResolved: true,
        directionAskCount: 1,
        completed: false,
        initialMode: "NEAR_TERM",
        background: { status: "FOUND", role: "software developer", yearsOfExperience: 5 },
        nearTermTarget: { step: "discovering_target", roleChoice: "DIFFERENT_ROLE" },
    },
    createdAt: new Date(0),
    updatedAt: new Date(4),
});

const createFirstRoleConversation = (latestUserMessage: string): Conversation => {
    const conversation = createDifferentRoleConversation(latestUserMessage);
    const onboardingFlow = conversation.onboardingFlow;
    if (!onboardingFlow) {
        throw new Error("Expected onboarding flow in test conversation");
    }
    return {
        ...conversation,
        messages: [
            { role: "user", content: "i want to find my first job", timestamp: new Date(0) },
            { role: "assistant", content: "What kind of job would you like to look for?", timestamp: new Date(1) },
            { role: "user", content: latestUserMessage, timestamp: new Date(2) },
        ],
        onboardingFlow: {
            ...onboardingFlow,
            background: { status: "NONE", role: null },
            nearTermTarget: { step: "discovering_target", clarificationCount: 0 },
        },
    };
};

describe("parseTargetRoleDecision", () => {
    it("accepts a concrete target role", () => {
        const decision = parseTargetRoleDecision('{"status":"READY","targetRole":"product manager"}');

        assert.deepEqual(decision, { status: "READY", targetRole: "product manager", discoveryFacts: {} });
    });

    it("requires an exact user evidence quote when validating a model decision", () => {
        const missingEvidence = parseTargetRoleDecision(
            JSON.stringify({ status: "READY", targetRole: "Data Analyst" }),
            "I want to become a data analyst",
        );
        const inventedEvidence = parseTargetRoleDecision(
            JSON.stringify({
                status: "READY",
                targetRole: "Product Manager",
                evidenceQuote: "own product direction",
            }),
            "something that involves working with data",
        );
        const supported = parseTargetRoleDecision(
            JSON.stringify({
                status: "READY",
                targetRole: "Data Analyst",
                evidenceQuote: "data analyst",
            }),
            "I want to become a data analyst",
        );

        assert.equal(missingEvidence, null);
        assert.equal(inventedEvidence, null);
        assert.deepEqual(supported, { status: "READY", targetRole: "Data Analyst", discoveryFacts: {} });
    });

    it("rejects placeholder role options", () => {
        const decision = parseTargetRoleDecision(JSON.stringify({
            status: "ROLE_OPTIONS",
            summary: "Here are some possible directions.",
            roles: [
                { title: "[searchable role 1]", reason: "A possible match for your background." },
                { title: "[searchable role 2]", reason: "Another possible match for your background." },
                { title: "[searchable role 3]", reason: "A third possible match for your background." },
            ],
        }));

        assert.equal(decision, null);
    });

    it("parses a dynamic discovery subject and supported facts", () => {
        const decision = parseTargetRoleDecision(JSON.stringify({
            status: "NEEDS_CLARIFICATION",
            question: "Would you rather collaborate closely with customers or focus on internal product work?",
            subject: "customer_collaboration",
            discoveryFacts: { enjoyed_work: "solving complex technical problems" },
        }));

        assert.deepEqual(decision, {
            status: "NEEDS_CLARIFICATION",
            question: "Would you rather collaborate closely with customers or focus on internal product work?",
            subject: "customer_collaboration",
            discoveryFacts: { enjoyed_work: "solving complex technical problems" },
        });
    });

    it("recovers a natural question and string facts from compact model formatting", () => {
        const decision = parseTargetRoleDecision(JSON.stringify({
            status: "NEEDS_CLARIFICATION",
            question: "would_you_rather_design_interfaces_write_code_or_help_customers",
            discoveryFacts: { interests: ["designing", "drawing"] },
        }));

        assert.deepEqual(decision, {
            status: "NEEDS_CLARIFICATION",
            question: "Would you rather design interfaces write code or help customers?",
            subject: "question_would_you_rather_design_interfaces_write_code_or_help_customers",
            discoveryFacts: { interests: "designing, drawing" },
        });
    });

    it("accepts grounded role options when the optional summary is empty", () => {
        const decision = parseTargetRoleDecision(JSON.stringify({
            status: "ROLE_OPTIONS",
            summary: "",
            roles: [
                { title: "UX Designer", reason: "Connects visual design with shaping digital product experiences." },
                { title: "Graphic Designer", reason: "Uses drawing and composition to create visual communication." },
                { title: "Digital Illustrator", reason: "Applies drawing skills directly in digital creative work." },
            ],
            discoveryFacts: { interests: ["designing", "drawing"] },
        }));

        assert.equal(decision?.status, "ROLE_OPTIONS");
        assert.equal(decision?.summary, "");
        assert.deepEqual(decision?.discoveryFacts, { interests: "designing, drawing" });
    });

    it("formats validated role options as a readable numbered list", () => {
        const reply = formatTargetRoleOptionsReply("These paths fit what you described.", [
            { title: "Product Manager", reason: "Connects your technical background with product ownership." },
            { title: "Solutions Engineer", reason: "Uses technical depth in customer-facing problem solving." },
            { title: "Technical Program Manager", reason: "Centers on coordination across technical teams." },
        ]);

        assert.match(reply, /1\. Product Manager — Connects/);
        assert.match(reply, /2\. Solutions Engineer — Uses/);
        assert.match(reply, /Which role feels closest, or do none of them fit\?$/);
        assert.doesNotMatch(reply, /\[searchable role/i);
    });

    it("rejects a question from an already completed onboarding stage", () => {
        const decision = parseTargetRoleDecision(JSON.stringify({
            status: "NEEDS_CLARIFICATION",
            question: ONBOARDING_DIRECTION_REASK_REPLY,
            subject: "timeline",
        }));

        assert.equal(decision, null);
    });
});

describe("buildTargetRoleDecisionPrompt", () => {
    it("describes the output contract without seeding a concrete role or preference", () => {
        const latestUserMessage = "something that involves working with data";
        const prompt = buildTargetRoleDecisionPrompt(
            createDifferentRoleConversation(latestUserMessage),
            latestUserMessage,
            "Current role / headline: software developer",
        );

        assert.match(prompt, /evidenceQuote/);
        assert.doesNotMatch(prompt, /own product direction/i);
        assert.doesNotMatch(prompt, /combines technical context with product ownership/i);
    });

    it("guides first-job discovery without pretending the user changed roles", () => {
        const latestUserMessage = "i dont really know";
        const prompt = buildTargetRoleDecisionPrompt(
            createFirstRoleConversation(latestUserMessage),
            latestUserMessage,
            "Name: shai",
        );

        assert.match(prompt, /choosing a first target role/i);
        assert.doesNotMatch(prompt, /already chose to move into a DIFFERENT role/);
        assert.match(prompt, /2-3 related job-relevant signals/i);
        assert.match(prompt, /generic continuation/i);
        assert.match(prompt, /uncertain answer.*easier.*concrete/i);
        assert.match(prompt, /each distinct newly stated signal.*own discoveryFacts entry/i);
        assert.doesNotMatch(prompt, /prefer ROLE_OPTIONS now/i);
    });

    it("distinguishes useful discovery from background and uncertainty", () => {
        const latestUserMessage = "i enjoy design and drawing";
        const conversation = createFirstRoleConversation(latestUserMessage);
        if (conversation.onboardingFlow?.nearTermTarget) {
            conversation.onboardingFlow.nearTermTarget.discoveryFacts = {
                interests: "drawing and design",
                preferred_activity: "creating visual work",
            };
        }

        const prompt = buildTargetRoleDecisionPrompt(conversation, latestUserMessage, "Name: shai");

        assert.match(prompt, /known skills or preferences distinguish useful paths/i);
        assert.match(prompt, /background, timing, and uncertainty do not count/i);
        assert.ok(prompt.length < 4_000);
    });
});

describe("parseTargetRoleGroundingDecision", () => {
    it("requires an exact user quote containing the proposed role", () => {
        const grounded = parseTargetRoleGroundingDecision(JSON.stringify({
            kind: "GROUNDED_ROLE",
            evidenceQuote: "product manager",
            normalizedTargetRole: "Product Manager",
        }), "product manager", "I want to be a product manager");
        const inferred = parseTargetRoleGroundingDecision(JSON.stringify({
            kind: "GROUNDED_ROLE",
            evidenceQuote: "leading teams",
            normalizedTargetRole: "Product Manager",
        }), "product manager", "leading teams");

        assert.deepEqual(grounded, {
            kind: "GROUNDED_ROLE",
            evidenceQuote: "product manager",
            normalizedTargetRole: "Product Manager",
        });
        assert.equal(inferred, null);
    });

    it("accepts contextual confirmation only when the previous assistant message names the candidate", () => {
        const rawText = JSON.stringify({
            kind: "GROUNDED_CONFIRMATION",
            evidenceQuote: "yes yes",
            normalizedTargetRole: "Data Analyst",
        });
        const grounded = parseTargetRoleGroundingDecision(
            rawText,
            "Data Analyst",
            "yes yes",
            [],
            "So, you're looking for a Data Analyst role?",
        );
        const ungrounded = parseTargetRoleGroundingDecision(
            rawText,
            "Data Analyst",
            "yes yes",
            [],
            "What role would you like?",
        );

        assert.deepEqual(grounded, {
            kind: "GROUNDED_CONFIRMATION",
            evidenceQuote: "yes yes",
            normalizedTargetRole: "Data Analyst",
        });
        assert.equal(ungrounded, null);
    });

    it("treats persisted null suggested roles as an empty list", () => {
        const decision = parseTargetRoleGroundingDecision(
            JSON.stringify({
                kind: "GROUNDED_SUGGESTION",
                evidenceQuote: "something that involves working with data",
            }),
            "Product Manager",
            "something that involves working with data",
            null as unknown as readonly string[],
        );

        assert.equal(decision, null);
    });

    it("accepts a wrapped clarification when the configured model omits the inner discriminator", () => {
        const question = "Would you rather focus on visual design, user research, or front-end implementation?";
        const decision = parseTargetRoleGroundingDecision(
            JSON.stringify({ NEEDS_CLARIFICATION: { question } }),
            "Software Developer",
            "i enjoy designing and drawing",
        );

        assert.deepEqual(decision, { kind: "NEEDS_CLARIFICATION", question });
    });
});

describe("parseTargetRoleOptionsReviewDecision", () => {
    it("rejects a role inferred from a broad field preference", () => {
        const decision = parseTargetRoleOptionsReviewDecision(JSON.stringify({
            verdict: "READY",
            targetRole: "Software Developer",
            evidenceQuote: "i want a hitech job",
        }), "i want a hitech job");

        assert.equal(decision, null);
    });
});

describe("parseTargetRoleSuggestionReviewDecision", () => {
    it("accepts a model-inferred reference to an active suggestion", () => {
        const decision = parseTargetRoleSuggestionReviewDecision(
            JSON.stringify({
                verdict: "SELECTED",
                targetRole: "Graphic Designer",
                evidenceQuote: "the first option sounds nice",
            }),
            "the first option sounds nice",
            ["Graphic Designer", "Digital Illustrator", "UI/UX Designer"],
        );

        assert.deepEqual(decision, {
            verdict: "SELECTED",
            targetRole: "Graphic Designer",
            evidenceQuote: "the first option sounds nice",
        });
    });

    it("rejects a model-selected role that was not offered", () => {
        const decision = parseTargetRoleSuggestionReviewDecision(
            JSON.stringify({
                verdict: "SELECTED",
                targetRole: "Art Director",
                evidenceQuote: "the first option sounds nice",
            }),
            "the first option sounds nice",
            ["Graphic Designer", "Digital Illustrator", "UI/UX Designer"],
        );

        assert.equal(decision, null);
    });
});

describe("resolveTargetRoleDecision", () => {
    it("returns relevant drawing roles from the configured model even when its summary is empty", async () => {
        const latestUserMessage = "i would like to work around designing and drawing";
        const conversation = createFirstRoleConversation(latestUserMessage);
        if (conversation.onboardingFlow?.nearTermTarget) {
            conversation.onboardingFlow.nearTermTarget.clarificationCount = 4;
            conversation.onboardingFlow.nearTermTarget.discoveryFacts = {
                education: "finished high school",
                preferred_field: "high tech",
            };
            conversation.onboardingFlow.nearTermTarget.coveredSubjects = [
                "preferred_activity",
                "work_environment",
                "technical_interest",
            ];
        }
        const roleOptions = {
            status: "ROLE_OPTIONS" as const,
            summary: "",
            roles: [
                { title: "UX Designer", reason: "Designing and drawing skills can support digital user experiences." },
                { title: "Graphic Designer", reason: "Uses drawing and composition in visual communication work." },
                { title: "Digital Illustrator", reason: "Applies drawing skills directly to digital creative projects." },
            ],
            discoveryFacts: { interests: "designing, drawing" },
        };
        const outputs = [
            JSON.stringify({
                status: "READY",
                targetRole: "",
                evidenceQuote: latestUserMessage,
                discoveryFacts: {},
            }),
            JSON.stringify({
                ...roleOptions,
                discoveryFacts: { interests: ["designing", "drawing"] },
            }),
            "not-json",
            "not-json",
        ];
        const textCompletion: TextCompletionPort = {
            complete: async () => outputs.shift() ?? "",
        };

        const decision = await resolveTargetRoleDecision({
            textCompletion,
            conversation,
            latestUserMessage,
            userAccountContext: "Name: shai; Education: finished high school",
            userId: "user-1",
            conversationId: "conversation-1",
        });

        assert.deepEqual(decision, roleOptions);
    });

    it("keeps a new model-generated question when the model repeats a placeholder subject", async () => {
        const latestUserMessage = "i want a hitech job";
        const conversation = createFirstRoleConversation(latestUserMessage);
        const previousQuestion = "What specific aspects of your first job are you most interested in or concerned about?";
        const nextQuestion = "Would you prefer creating visual interfaces, writing code, or helping customers with technology?";
        conversation.messages.splice(-1, 0,
            { role: "user", content: "i dont know whats out there", timestamp: new Date(2) },
            { role: "assistant", content: previousQuestion, timestamp: new Date(3) },
        );
        if (conversation.onboardingFlow?.nearTermTarget) {
            conversation.onboardingFlow.nearTermTarget.clarificationCount = 1;
            conversation.onboardingFlow.nearTermTarget.coveredSubjects = ["semantic focus"];
        }
        const modelDecision = JSON.stringify({
            status: "NEEDS_CLARIFICATION",
            question: nextQuestion,
            subject: "semantic focus",
            discoveryFacts: { preferred_industry: "high tech" },
        });
        const textCompletion: TextCompletionPort = {
            complete: async () => modelDecision,
        };

        const decision = await resolveTargetRoleDecision({
            textCompletion,
            conversation,
            latestUserMessage,
            userAccountContext: "Name: shai; Education: finished high school",
            userId: "user-1",
            conversationId: "conversation-1",
        });

        assert.equal(decision.status, "NEEDS_CLARIFICATION");
        if (decision.status !== "NEEDS_CLARIFICATION") {
            throw new Error("Expected a discovery question");
        }
        assert.equal(decision.question, nextQuestion);
        assert.notEqual(decision.subject, "semantic focus");
        assert.deepEqual(decision.discoveryFacts, { preferred_industry: "high tech" });
    });

    it("rejects a question repeated from earlier in the conversation even when its subject changes", async () => {
        const repeatedQuestion = "What specific aspects of 'work' or 'job' are you unsure about?";
        const recoveryQuestion = "Would you rather create visual designs, digital products, or physical objects?";
        const conversation = createFirstRoleConversation("creating things");
        conversation.messages = [
            { role: "assistant", content: "What kind of work are you most interested in doing?", timestamp: new Date(0) },
            { role: "user", content: "i actually dont know", timestamp: new Date(1) },
            { role: "assistant", content: repeatedQuestion, timestamp: new Date(2) },
            { role: "user", content: "i am not sure in what field i want to work", timestamp: new Date(3) },
            {
                role: "assistant",
                content: "Do you envision your first job involving working with people, creating things, or analyzing data?",
                timestamp: new Date(4),
            },
            { role: "user", content: "creating things", timestamp: new Date(5) },
        ];
        if (conversation.onboardingFlow?.nearTermTarget) {
            conversation.onboardingFlow.nearTermTarget.clarificationCount = 3;
            conversation.onboardingFlow.nearTermTarget.coveredSubjects = [
                "work_interests",
                "job_type_uncertainty",
                "preferred_contribution",
            ];
        }
        const outputs = [
            JSON.stringify({
                status: "NEEDS_CLARIFICATION",
                question: repeatedQuestion,
                subject: "uncertainty_about_job_type",
                discoveryFacts: {},
            }),
            JSON.stringify({
                status: "NEEDS_CLARIFICATION",
                question: repeatedQuestion,
                subject: "uncertainty_about_work",
                discoveryFacts: {},
            }),
            JSON.stringify({
                status: "NEEDS_CLARIFICATION",
                question: recoveryQuestion,
                subject: "creative_medium",
                discoveryFacts: { preferred_activity: "creating things" },
            }),
        ];
        const textCompletion: TextCompletionPort = {
            complete: async () => outputs.shift() ?? "",
        };

        const decision = await resolveTargetRoleDecision({
            textCompletion,
            conversation,
            latestUserMessage: "creating things",
            userAccountContext: "Name: shai; Education: finished high school",
            userId: "user-1",
            conversationId: "conversation-1",
        });

        assert.deepEqual(decision, {
            status: "NEEDS_CLARIFICATION",
            question: recoveryQuestion,
            subject: "creative_medium",
            discoveryFacts: { preferred_activity: "creating things" },
        });
        assert.equal(outputs.length, 0);
    });

    it("rejects generic uncertainty questions that do not build on the user's answer", async () => {
        const genericQuestion = "What specific aspects of work are you unsure about?";
        const recoveryQuestion = "Would you rather create visual designs, digital products, or physical objects?";
        const conversation = createFirstRoleConversation("creating things");
        const outputs = [
            JSON.stringify({
                status: "NEEDS_CLARIFICATION",
                question: genericQuestion,
                subject: "work_uncertainty",
                discoveryFacts: {},
            }),
            JSON.stringify({
                status: "NEEDS_CLARIFICATION",
                question: genericQuestion,
                subject: "uncertainty_details",
                discoveryFacts: {},
            }),
            JSON.stringify({
                status: "NEEDS_CLARIFICATION",
                question: recoveryQuestion,
                subject: "creative_medium",
                discoveryFacts: { preferred_activity: "creating things" },
            }),
        ];
        const textCompletion: TextCompletionPort = {
            complete: async () => outputs.shift() ?? "",
        };

        const decision = await resolveTargetRoleDecision({
            textCompletion,
            conversation,
            latestUserMessage: "creating things",
            userAccountContext: "Name: shai; Education: finished high school",
            userId: "user-1",
            conversationId: "conversation-1",
        });

        assert.deepEqual(decision, {
            status: "NEEDS_CLARIFICATION",
            question: recoveryQuestion,
            subject: "creative_medium",
            discoveryFacts: { preferred_activity: "creating things" },
        });
        assert.equal(outputs.length, 0);
    });

    it("keeps model-generated role suggestions when the user explicitly asks for them", async () => {
        const conversation = createFirstRoleConversation("you suggest");
        if (conversation.onboardingFlow?.nearTermTarget) {
            conversation.messages.splice(-1, 0,
                { role: "user", content: "i dont know", timestamp: new Date(2) },
                {
                    role: "assistant",
                    content: "Which school subjects or activities have you enjoyed most?",
                    timestamp: new Date(3),
                },
                { role: "user", content: "i like drawing", timestamp: new Date(4) },
                {
                    role: "assistant",
                    content: "Would you like creative work on paper, on a computer, or with physical objects?",
                    timestamp: new Date(5),
                },
            );
            conversation.onboardingFlow.nearTermTarget.clarificationCount = 2;
            conversation.onboardingFlow.nearTermTarget.discoveryFacts = { interest: "drawing" };
            conversation.onboardingFlow.nearTermTarget.coveredSubjects = ["school_interests", "creative_medium"];
        }
        const roleOptions = {
            status: "ROLE_OPTIONS" as const,
            summary: "Since you enjoy drawing, these entry-level directions may fit.",
            roles: [
                { title: "Graphic Design Assistant", reason: "Uses drawing and visual composition in practical design work." },
                { title: "Junior Illustrator", reason: "Focuses directly on creating drawings for visual projects." },
                { title: "Print Production Assistant", reason: "Combines visual attention with hands-on production tasks." },
            ],
            discoveryFacts: { interest: "drawing" },
        };
        const outputs = [JSON.stringify(roleOptions), JSON.stringify({ verdict: "KEEP_OPTIONS" })];
        const prompts: string[] = [];
        const textCompletion: TextCompletionPort = {
            complete: async (prompt) => {
                prompts.push(prompt);
                return outputs.shift() ?? "";
            },
        };

        const decision = await resolveTargetRoleDecision({
            textCompletion,
            conversation,
            latestUserMessage: "you suggest",
            userAccountContext: "Name: shai",
            userId: "user-1",
            conversationId: "conversation-1",
        });

        assert.deepEqual(decision, roleOptions);
        assert.match(prompts[0] ?? "", /USER: i like drawing/i);
        assert.match(prompts[0] ?? "", /Latest user message: you suggest/i);
    });

    it("continues with a model-generated question after a first uncertain answer", async () => {
        const roleOptions = {
            status: "ROLE_OPTIONS",
            summary: "Here are a few paths.",
            roles: [
                { title: "Data Analyst", reason: "Could suit someone interested in working with information." },
                { title: "Marketing Assistant", reason: "Could suit someone interested in creative communication." },
                { title: "Customer Service Representative", reason: "Could suit someone who enjoys helping people." },
            ],
            discoveryFacts: {},
        };
        const outputs = [
            JSON.stringify(roleOptions),
            JSON.stringify({
                verdict: "RESUME_DISCOVERY",
                question: "Which school subjects or activities have you enjoyed most?",
                subject: "school_interests",
                discoveryFacts: {},
                rejectedSuggestedRoles: false,
            }),
        ];
        const textCompletion: TextCompletionPort = {
            complete: async () => outputs.shift() ?? "",
        };

        const decision = await resolveTargetRoleDecision({
            textCompletion,
            conversation: createFirstRoleConversation("i dont really know"),
            latestUserMessage: "i dont really know",
            userAccountContext: "Name: shai",
            userId: "user-1",
            conversationId: "conversation-1",
        });

        assert.deepEqual(decision, {
            status: "NEEDS_CLARIFICATION",
            question: "Which school subjects or activities have you enjoyed most?",
            subject: "school_interests",
            discoveryFacts: {},
            rejectedSuggestedRoles: false,
        });
    });

    it("returns to model-generated discovery when the user rejects all suggested roles", async () => {
        const conversation = createFirstRoleConversation("none of them fit");
        if (conversation.onboardingFlow?.nearTermTarget) {
            conversation.onboardingFlow.nearTermTarget.suggestedRoles = [
                "Data Analyst",
                "Digital Marketing Specialist",
                "Customer Service Representative",
            ];
        }
        const outputs = [
            JSON.stringify({ verdict: "CONTINUE_DISCOVERY" }),
            JSON.stringify({
                status: "ROLE_OPTIONS",
                summary: "Here are some alternatives.",
                roles: [
                    { title: "Data Analyst", reason: "Works with data and reports." },
                    { title: "Digital Marketing Specialist", reason: "Works on creative campaigns." },
                    { title: "Customer Service Representative", reason: "Helps customers solve problems." },
                ],
                discoveryFacts: {},
            }),
            JSON.stringify({
                verdict: "RESUME_DISCOVERY",
                question: "Would you rather spend your day working with people, ideas, or practical tasks?",
                subject: "preferred_activity",
                discoveryFacts: {},
                rejectedSuggestedRoles: true,
            }),
        ];
        const textCompletion: TextCompletionPort = {
            complete: async () => outputs.shift() ?? "",
        };

        const decision = await resolveTargetRoleDecision({
            textCompletion,
            conversation,
            latestUserMessage: "none of them fit",
            userAccountContext: "Name: shai",
            userId: "user-1",
            conversationId: "conversation-1",
        });

        assert.deepEqual(decision, {
            status: "NEEDS_CLARIFICATION",
            question: "Would you rather spend your day working with people, ideas, or practical tasks?",
            subject: "preferred_activity",
            discoveryFacts: {},
            rejectedSuggestedRoles: true,
        });
    });

    it("accepts the discriminator-wrapped grounding shape returned by the configured model", async () => {
        const conversation = createDifferentRoleConversation("data analyst sounds good");
        if (conversation.onboardingFlow?.nearTermTarget) {
            conversation.onboardingFlow.nearTermTarget.suggestedRoles = [
                "Data Analyst",
                "Business Intelligence Developer",
                "Data Engineer",
            ];
        }
        const outputs = [
            JSON.stringify({ verdict: "CONTINUE_DISCOVERY" }),
            JSON.stringify({
                status: "READY",
                targetRole: "Data Analyst",
                evidenceQuote: "data analyst sounds good",
                discoveryFacts: { desiredDomain: "data" },
            }),
            JSON.stringify({
                GROUNDED_ROLE: {
                    kind: "GROUNDED_ROLE",
                    evidenceQuote: "data analyst sounds good",
                    normalizedTargetRole: "Data Analyst",
                },
            }),
        ];
        const textCompletion: TextCompletionPort = {
            complete: async () => outputs.shift() ?? "",
        };

        const decision = await resolveTargetRoleDecision({
            textCompletion,
            conversation,
            latestUserMessage: "data analyst sounds good",
            userAccountContext: "Current role / headline: software developer",
            userId: "user-1",
            conversationId: "conversation-1",
        });

        assert.deepEqual(decision, {
            status: "READY",
            targetRole: "Data Analyst",
            discoveryFacts: { desiredDomain: "data" },
        });
    });

    it("preserves useful role options when the reviewer approves them", async () => {
        const roleOptions = {
            status: "ROLE_OPTIONS",
            summary: "Your interest in working with data points to these paths.",
            roles: [
                { title: "Data Scientist", reason: "Uses statistical analysis to find patterns in complex data." },
                { title: "Business Intelligence Developer", reason: "Builds reporting and analytics systems." },
                { title: "Operations Research Analyst", reason: "Uses data to optimize operational decisions." },
            ],
            discoveryFacts: { desired_work: "working with data" },
        };
        const outputs = [
            JSON.stringify(roleOptions),
            JSON.stringify({ verdict: "KEEP_OPTIONS" }),
        ];
        const textCompletion: TextCompletionPort = {
            complete: async () => outputs.shift() ?? "",
        };
        const conversation = createDifferentRoleConversation("something that involves working with data");
        if (conversation.onboardingFlow?.nearTermTarget) {
            conversation.onboardingFlow.nearTermTarget.discoveryFacts = {
                enjoyed_work: "solving analytical problems",
                preferred_domain: "data",
            };
        }

        const decision = await resolveTargetRoleDecision({
            textCompletion,
            conversation,
            latestUserMessage: "something that involves working with data",
            userAccountContext: "Current role / headline: software developer",
            userId: "user-1",
            conversationId: "conversation-1",
        });

        assert.deepEqual(decision, roleOptions);
    });

    it("understands confirmation of the concrete role in the previous assistant question", async () => {
        const conversation = createDifferentRoleConversation("yes yes");
        conversation.messages.splice(-1, 0, {
            role: "assistant",
            content: "So, you're looking for a data analyst role?",
            timestamp: new Date(3.5),
        });
        const outputs = [
            JSON.stringify({
                status: "READY",
                targetRole: "Data Analyst",
                evidenceQuote: "yes yes",
                discoveryFacts: {},
            }),
            JSON.stringify({
                kind: "GROUNDED_CONFIRMATION",
                evidenceQuote: "yes yes",
                normalizedTargetRole: "Data Analyst",
            }),
        ];
        const textCompletion: TextCompletionPort = {
            complete: async () => outputs.shift() ?? "",
        };

        const decision = await resolveTargetRoleDecision({
            textCompletion,
            conversation,
            latestUserMessage: "yes yes",
            userAccountContext: "Current role / headline: QA Automation & Performance Engineer",
            userId: "user-1",
            conversationId: "conversation-1",
        });

        assert.deepEqual(decision, { status: "READY", targetRole: "Data Analyst", discoveryFacts: {} });
    });

    it("normalizes an obvious target-role typo before handing the query to job search", async () => {
        const outputs = [
            JSON.stringify({
                status: "READY",
                targetRole: "Data Analystt",
                evidenceQuote: "Data Analystt",
                discoveryFacts: {},
            }),
            JSON.stringify({
                kind: "GROUNDED_ROLE",
                evidenceQuote: "Data Analystt",
                normalizedTargetRole: "Data Analyst",
            }),
        ];
        const textCompletion: TextCompletionPort = {
            complete: async () => outputs.shift() ?? "",
        };

        const decision = await resolveTargetRoleDecision({
            textCompletion,
            conversation: createDifferentRoleConversation("Data Analystt"),
            latestUserMessage: "Data Analystt",
            userAccountContext: "Current role / headline: software developer",
            userId: "user-1",
            conversationId: "conversation-1",
        });

        assert.deepEqual(decision, { status: "READY", targetRole: "Data Analyst", discoveryFacts: {} });
    });

    it("accepts a newly proposed concrete role after earlier role options", async () => {
        const conversation = createDifferentRoleConversation("what about data analyst?");
        if (conversation.onboardingFlow?.nearTermTarget) {
            conversation.onboardingFlow.nearTermTarget.suggestedRoles = [
                "Data Scientist",
                "Business Intelligence Developer",
                "Product Manager (Data-Driven)",
            ];
        }
        const outputs = [
            JSON.stringify({ verdict: "CONTINUE_DISCOVERY" }),
            JSON.stringify({
                status: "ROLE_OPTIONS",
                summary: "Your technical background and desire to work with data point to these paths.",
                roles: [
                    { title: "Product Manager", reason: "Combines technical context with product ownership." },
                    { title: "Solutions Engineer", reason: "Uses technical knowledge in customer-facing work." },
                    { title: "Technical Program Manager", reason: "Focuses on coordination and delivery." },
                ],
            }),
            JSON.stringify({ verdict: "READY", targetRole: "data analyst", evidenceQuote: "data analyst" }),
            JSON.stringify({
                kind: "GROUNDED_ROLE",
                evidenceQuote: "data analyst",
                normalizedTargetRole: "data analyst",
            }),
        ];
        const prompts: string[] = [];
        const textCompletion: TextCompletionPort = {
            complete: async (prompt) => {
                prompts.push(prompt);
                return outputs[prompts.length - 1] ?? "";
            },
        };

        const decision = await resolveTargetRoleDecision({
            textCompletion,
            conversation,
            latestUserMessage: "what about data analyst?",
            userAccountContext: "Current role / headline: software developer",
            userId: "user-1",
            conversationId: "conversation-1",
        });

        assert.deepEqual(decision, { status: "READY", targetRole: "data analyst", discoveryFacts: {} });
        assert.equal(prompts.length, 4);
        assert.match(prompts[2] ?? "", /review the prior role decision/i);
        assert.match(prompts[2] ?? "", /what about data analyst\?/i);
    });

    it("treats an explicitly named DevOps target as ready instead of offering adjacent roles", async () => {
        const outputs = [
            JSON.stringify({
                status: "ROLE_OPTIONS",
                summary: "Your experience as a software developer and interest in DevOps point to these paths.",
                roles: [
                    { title: "DevOps Engineer", reason: "Combines technical knowledge with infrastructure management." },
                    { title: "Solutions Architect", reason: "Focuses on designing systems that meet business needs." },
                    { title: "Cloud Engineer", reason: "Uses technical expertise to manage cloud-based infrastructure." },
                ],
            }),
            JSON.stringify({ verdict: "READY", targetRole: "devops", evidenceQuote: "devops" }),
            JSON.stringify({ kind: "GROUNDED_ROLE", evidenceQuote: "devops", normalizedTargetRole: "devops" }),
        ];
        const prompts: string[] = [];
        const textCompletion: TextCompletionPort = {
            complete: async (prompt) => {
                prompts.push(prompt);
                return outputs[prompts.length - 1] ?? "";
            },
        };

        const decision = await resolveTargetRoleDecision({
            textCompletion,
            conversation: createDifferentRoleConversation("i would like to do more devops"),
            latestUserMessage: "i would like to do more devops",
            userAccountContext: "Current role / headline: software developer",
            userId: "user-1",
            conversationId: "conversation-1",
        });

        assert.deepEqual(decision, { status: "READY", targetRole: "devops", discoveryFacts: {} });
        assert.equal(prompts.length, 3);
    });

    it("switches from open questions to model-generated role choices after the limit", async () => {
        const conversation = createDifferentRoleConversation("i really don't know");
        if (conversation.onboardingFlow?.nearTermTarget) {
            conversation.onboardingFlow.nearTermTarget.clarificationCount = 4;
            conversation.onboardingFlow.nearTermTarget.discoveryFacts = {
                enjoyed_work: "solving technical problems",
            };
            conversation.onboardingFlow.nearTermTarget.coveredSubjects = ["enjoyed_work"];
        }
        const outputs = [
            JSON.stringify({
                status: "NEEDS_CLARIFICATION",
                question: "What kind of work sounds appealing?",
                subject: "desired_work",
            }),
            JSON.stringify({
                status: "ROLE_OPTIONS",
                summary: "You value strategy, collaboration, and leadership.",
                roles: [
                    { title: "Product Manager", reason: "Connects strategy with cross-functional product ownership." },
                    { title: "Program Manager", reason: "Uses collaboration to coordinate complex initiatives." },
                    { title: "Operations Manager", reason: "Applies leadership to improve teams and processes." },
                ],
            }),
            JSON.stringify({ verdict: "KEEP_OPTIONS" }),
        ];
        const prompts: string[] = [];
        const textCompletion: TextCompletionPort = {
            complete: async (prompt) => {
                prompts.push(prompt);
                return outputs[prompts.length - 1] ?? "";
            },
        };

        const decision = await resolveTargetRoleDecision({
            textCompletion,
            conversation,
            latestUserMessage: "i really don't know",
            userAccountContext: "Current role / headline: software developer",
            userId: "user-1",
            conversationId: "conversation-1",
        });

        assert.equal(decision.status, "ROLE_OPTIONS");
        assert.equal(prompts.length, 3);
        assert.match(prompts[0] ?? "", /mustOfferChoices=true/);
        assert.match(prompts[0] ?? "", /solving technical problems/);
        assert.match(prompts[0] ?? "", /coveredSubjects=\["enjoyed_work"\]/);
        assert.match(prompts[0] ?? "", /Current role \/ headline: software developer/);
        assert.match(prompts[2] ?? "", /review the prior role decision/i);
    });

    it("recovers with a new question when premature role options fail review", async () => {
        const latestUserMessage = "mix of both";
        const conversation = createFirstRoleConversation(latestUserMessage);
        if (conversation.onboardingFlow?.nearTermTarget) {
            conversation.onboardingFlow.nearTermTarget.clarificationCount = 3;
            conversation.onboardingFlow.nearTermTarget.discoveryFacts = {
                recent_high_school_graduation: "true",
                job_search_now: "true",
                human_interaction_needed: "?",
            };
            conversation.onboardingFlow.nearTermTarget.coveredSubjects = [
                "task_oriented_work",
                "people_and_technology",
            ];
        }
        const recoveryQuestion = "Would you rather create things, solve problems, or help people directly?";
        const outputs = [
            JSON.stringify({
                status: "ROLE_OPTIONS",
                summary: "",
                roles: [
                    { title: "Data Entry Clerk", reason: "Recent high school graduation and human interaction." },
                    { title: "Customer Service Representative", reason: "Interest in people and technology." },
                    { title: "Help Desk Technician", reason: "Recent high school graduation and technology." },
                ],
                discoveryFacts: {
                    recent_high_school_graduation: "true",
                    job_search_now: "true",
                    human_interaction_needed: "?",
                },
            }),
            JSON.stringify({
                verdict: "RESUME_DISCOVERY",
                question: "What specific tasks would you like to perform in your job?",
                subject: "task_oriented_work",
                discoveryFacts: {},
                rejectedSuggestedRoles: false,
            }),
            JSON.stringify({
                verdict: "READY",
                targetRole: "Data Entry Clerk",
                evidenceQuote: "i dont know",
            }),
            JSON.stringify({
                status: "NEEDS_CLARIFICATION",
                question: recoveryQuestion,
                subject: "preferred_contribution",
                discoveryFacts: { people_and_technology: "mix of both" },
            }),
        ];
        const prompts: string[] = [];
        const textCompletion: TextCompletionPort = {
            complete: async (prompt) => {
                prompts.push(prompt);
                return outputs.shift() ?? "";
            },
        };

        const decision = await resolveTargetRoleDecision({
            textCompletion,
            conversation,
            latestUserMessage,
            userAccountContext: "Name: shai",
            userId: "user-1",
            conversationId: "conversation-1",
        });

        assert.deepEqual(decision, {
            status: "NEEDS_CLARIFICATION",
            question: recoveryQuestion,
            subject: "preferred_contribution",
            discoveryFacts: { people_and_technology: "mix of both" },
        });
        assert.equal(prompts.length, 4);
    });

    it("understands selection of a previously generated role suggestion", async () => {
        const conversation = createDifferentRoleConversation("the first one");
        if (conversation.onboardingFlow?.nearTermTarget) {
            conversation.onboardingFlow.nearTermTarget.suggestedRoles = [
                "Product Manager",
                "Program Manager",
                "Operations Manager",
            ];
        }
        const outputs = [JSON.stringify({
            verdict: "SELECTED",
            targetRole: "Product Manager",
            evidenceQuote: "the first one",
        })];
        const textCompletion: TextCompletionPort = {
            complete: async () => outputs.shift() ?? "",
        };

        const decision = await resolveTargetRoleDecision({
            textCompletion,
            conversation,
            latestUserMessage: "the first one",
            userAccountContext: "Current role / headline: software developer",
            userId: "user-1",
            conversationId: "conversation-1",
        });

        assert.deepEqual(decision, { status: "READY", targetRole: "Product Manager", discoveryFacts: {} });
    });

    it("resolves a clear suggestion reference before general discovery", async () => {
        const latestUserMessage = "the first option sounds nice";
        const conversation = createFirstRoleConversation(latestUserMessage);
        if (conversation.onboardingFlow?.nearTermTarget) {
            conversation.onboardingFlow.nearTermTarget.suggestedRoles = [
                "Graphic Designer",
                "Digital Illustrator",
                "UI/UX Designer",
            ];
        }
        const outputs = [JSON.stringify({
            verdict: "SELECTED",
            targetRole: "Graphic Designer",
            evidenceQuote: latestUserMessage,
        })];
        const prompts: string[] = [];
        const textCompletion: TextCompletionPort = {
            complete: async (prompt) => {
                prompts.push(prompt);
                return outputs.shift() ?? "";
            },
        };

        const decision = await resolveTargetRoleDecision({
            textCompletion,
            conversation,
            latestUserMessage,
            userAccountContext: "Name: shai",
            userId: "user-1",
            conversationId: "conversation-1",
        });

        assert.deepEqual(decision, { status: "READY", targetRole: "Graphic Designer", discoveryFacts: {} });
        assert.equal(prompts.length, 1);
        assert.match(prompts[0] ?? "", /Infer references semantically/);
        assert.match(prompts[0] ?? "", /1\. Graphic Designer/);
    });

    it("resolves a selected saved role before invalid general decisions can trigger discovery", async () => {
        const latestUserMessage = "UI/UX Designer sounds great";
        const conversation = createFirstRoleConversation(latestUserMessage);
        if (conversation.onboardingFlow?.nearTermTarget) {
            conversation.onboardingFlow.nearTermTarget.suggestedRoles = [
                "UI/UX Designer",
                "Web Developer",
                "Graphic Designer",
            ];
        }
        const prompts: string[] = [];
        const textCompletion: TextCompletionPort = {
            complete: async (prompt) => {
                prompts.push(prompt);
                if (prompt.includes("Decide whether the latest reply selects")) {
                    return JSON.stringify({
                        verdict: "SELECTED",
                        targetRole: "UI/UX Designer",
                        evidenceQuote: latestUserMessage,
                    });
                }
                return JSON.stringify({
                    status: "READY",
                    targetRole: "",
                    evidenceQuote: latestUserMessage,
                    discoveryFacts: {},
                });
            },
        };

        const decision = await resolveTargetRoleDecision({
            textCompletion,
            conversation,
            latestUserMessage,
            userAccountContext: "Name: shai",
            userId: "user-1",
            conversationId: "conversation-1",
        });

        assert.deepEqual(decision, { status: "READY", targetRole: "UI/UX Designer", discoveryFacts: {} });
        assert.equal(prompts.length, 1);
    });

    it("uses the model's targeted clarification when a suggestion reference is ambiguous", async () => {
        const latestUserMessage = "one of the design ones sounds good";
        const conversation = createFirstRoleConversation(latestUserMessage);
        if (conversation.onboardingFlow?.nearTermTarget) {
            conversation.onboardingFlow.nearTermTarget.suggestedRoles = [
                "Graphic Designer",
                "Digital Illustrator",
                "UI/UX Designer",
            ];
        }
        const outputs = [JSON.stringify({
            verdict: "CLARIFY_SELECTION",
            question: "Do you mean Graphic Designer, Digital Illustrator, or UI/UX Designer?",
        })];
        const textCompletion: TextCompletionPort = {
            complete: async () => outputs.shift() ?? "",
        };

        const decision = await resolveTargetRoleDecision({
            textCompletion,
            conversation,
            latestUserMessage,
            userAccountContext: "Name: shai",
            userId: "user-1",
            conversationId: "conversation-1",
        });

        assert.deepEqual(decision, {
            status: "NEEDS_CLARIFICATION",
            question: "Do you mean Graphic Designer, Digital Illustrator, or UI/UX Designer?",
            subject: "question_do_you_mean_graphic_designer_digital_illustrator_or_ui_ux_designer",
            discoveryFacts: {},
        });
    });

    it("accepts a suggested role title without requiring its description", async () => {
        const conversation = createDifferentRoleConversation("Financial Analyst");
        if (conversation.onboardingFlow?.nearTermTarget) {
            conversation.onboardingFlow.nearTermTarget.suggestedRoles = [
                "Product Manager",
                "Solutions Engineer",
                "Financial Analyst",
            ];
        }
        const outputs = [JSON.stringify({
            verdict: "SELECTED",
            targetRole: "Financial Analyst",
            evidenceQuote: "Financial Analyst",
        })];
        const prompts: string[] = [];
        const textCompletion: TextCompletionPort = {
            complete: async (prompt) => {
                prompts.push(prompt);
                return outputs[prompts.length - 1] ?? "";
            },
        };

        const decision = await resolveTargetRoleDecision({
            textCompletion,
            conversation,
            latestUserMessage: "Financial Analyst",
            userAccountContext: "Current role / headline: software developer",
            userId: "user-1",
            conversationId: "conversation-1",
        });

        assert.deepEqual(decision, { status: "READY", targetRole: "Financial Analyst", discoveryFacts: {} });
        assert.equal(prompts.length, 1);
    });

    it("offers roles instead of searching when the user has not selected a target", async () => {
        const conversation = createDifferentRoleConversation("are there any relevant jobs?");
        if (conversation.onboardingFlow?.nearTermTarget) {
            conversation.onboardingFlow.nearTermTarget.clarificationCount = 4;
        }
        const textCompletion: TextCompletionPort = {
            complete: async () => JSON.stringify({
                status: "ROLE_OPTIONS",
                summary: "Based on your preferences, these are the strongest directions.",
                roles: [
                    { title: "Product Manager", reason: "Combines technical knowledge with product decisions." },
                    { title: "Program Manager", reason: "Centers on cross-team planning and execution." },
                    { title: "Solutions Engineer", reason: "Applies technical knowledge to customer problems." },
                ],
            }),
        };

        const decision = await resolveTargetRoleDecision({
            textCompletion,
            conversation,
            latestUserMessage: "are there any relevant jobs?",
            userAccountContext: "Current role / headline: software developer",
            userId: "user-1",
            conversationId: "conversation-1",
        });

        assert.equal(decision.status, "ROLE_OPTIONS");
    });

    it("does not search an inferred role when the user only described a responsibility", async () => {
        const outputs = [
            JSON.stringify({ status: "READY", targetRole: "product manager", evidenceQuote: "leading teams" }),
            JSON.stringify({
                kind: "NEEDS_CLARIFICATION",
                question: "Would you prefer to lead an engineering team, own product direction, or manage projects?",
            }),
        ];
        const prompts: string[] = [];
        const textCompletion: TextCompletionPort = {
            complete: async (prompt) => {
                prompts.push(prompt);
                return outputs[prompts.length - 1] ?? "";
            },
        };

        const decision = await resolveTargetRoleDecision({
            textCompletion,
            conversation: createDifferentRoleConversation("leading teams"),
            latestUserMessage: "leading teams",
            userAccountContext: "Current role / headline: software developer",
            userId: "user-1",
            conversationId: "conversation-1",
        });

        assert.deepEqual(decision, {
            status: "NEEDS_CLARIFICATION",
            question: "Would you prefer to lead an engineering team, own product direction, or manage projects?",
            subject: "target_role",
            discoveryFacts: {},
        });
        assert.equal(prompts.length, 2);
        assert.match(prompts[1] ?? "", /concrete searchable role or established job domain/i);
    });

    it("retries a wrong-stage response and understands the target role from the chat", async () => {
        const outputs = [
            JSON.stringify({
                status: "NEEDS_CLARIFICATION",
                question: ONBOARDING_DIRECTION_REASK_REPLY,
                subject: "timeline",
            }),
            JSON.stringify({
                status: "READY",
                targetRole: "product manager",
                evidenceQuote: "product manager",
            }),
            JSON.stringify({
                kind: "GROUNDED_ROLE",
                evidenceQuote: "product manager",
                normalizedTargetRole: "product manager",
            }),
        ];
        const prompts: string[] = [];
        const textCompletion: TextCompletionPort = {
            complete: async (prompt) => {
                prompts.push(prompt);
                return outputs[prompts.length - 1] ?? "";
            },
        };

        const decision = await resolveTargetRoleDecision({
            textCompletion,
            conversation: createDifferentRoleConversation(),
            latestUserMessage: "product manager",
            userAccountContext: "Current role / headline: software developer",
            userId: "user-1",
            conversationId: "conversation-1",
        });

        assert.deepEqual(decision, { status: "READY", targetRole: "product manager", discoveryFacts: {} });
        assert.equal(prompts.length, 3);
        assert.match(prompts[0] ?? "", /Latest user message: product manager/);
        assert.match(prompts[1] ?? "", /previous output was invalid/i);
        assert.match(prompts[2] ?? "", /concrete searchable role or established job domain/i);
        assert.match(prompts[2] ?? "", /Do not demand a subtype, specialization, seniority/i);
    });

    it("uses a focused model recovery question after two invalid decision responses", async () => {
        const recoveryQuestion = "Would you rather create things, solve technical problems, or work directly with people?";
        const outputs = [
            "not-json",
            "not-json",
            JSON.stringify({
                status: "NEEDS_CLARIFICATION",
                question: recoveryQuestion,
                discoveryFacts: {},
            }),
        ];
        const prompts: string[] = [];
        const textCompletion: TextCompletionPort = {
            complete: async (prompt) => {
                prompts.push(prompt);
                return outputs.shift() ?? "";
            },
        };

        const decision = await resolveTargetRoleDecision({
            textCompletion,
            conversation: createDifferentRoleConversation(),
            latestUserMessage: "something different",
            userAccountContext: "Current role / headline: software developer",
            userId: "user-1",
            conversationId: "conversation-1",
        });

        assert.equal(decision.status, "NEEDS_CLARIFICATION");
        if (decision.status !== "NEEDS_CLARIFICATION") {
            throw new Error("Expected a recovery question");
        }
        assert.equal(decision.question, recoveryQuestion);
        assert.match(prompts[2] ?? "", /Do not ask for a job title/i);
    });
});
