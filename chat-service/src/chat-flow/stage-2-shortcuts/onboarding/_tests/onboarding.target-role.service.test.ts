import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Conversation } from "../../../../routes/conversation/conversation.model";
import type { TextCompletionPort } from "../../../../litellm/text-completion/text-completion.types";
import {
    parseTargetRoleDecision,
    parseTargetRoleGroundingDecision,
} from "../onboarding.target-role.llm.utils";
import { resolveTargetRoleDecision } from "../onboarding.target-role.service";
import { formatTargetRoleOptionsReply } from "../onboarding.target-role.utils";
import { ONBOARDING_DIFFERENT_ROLE_REPLY, ONBOARDING_DIRECTION_REASK_REPLY } from "../onboarding.types";

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

describe("parseTargetRoleDecision", () => {
    it("accepts a concrete target role", () => {
        const decision = parseTargetRoleDecision('{"status":"READY","targetRole":"product manager"}');

        assert.deepEqual(decision, { status: "READY", targetRole: "product manager", discoveryFacts: {} });
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
});

describe("resolveTargetRoleDecision", () => {
    it("understands confirmation of the concrete role in the previous assistant question", async () => {
        const conversation = createDifferentRoleConversation("yes yes");
        conversation.messages.splice(-1, 0, {
            role: "assistant",
            content: "So, you're looking for a data analyst role?",
            timestamp: new Date(3.5),
        });
        const outputs = [
            JSON.stringify({ status: "READY", targetRole: "Data Analyst", discoveryFacts: {} }),
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
            JSON.stringify({ status: "READY", targetRole: "Data Analystt", discoveryFacts: {} }),
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
            JSON.stringify({
                status: "ROLE_OPTIONS",
                summary: "Your technical background and desire to work with data point to these paths.",
                roles: [
                    { title: "Product Manager", reason: "Combines technical context with product ownership." },
                    { title: "Solutions Engineer", reason: "Uses technical knowledge in customer-facing work." },
                    { title: "Technical Program Manager", reason: "Focuses on coordination and delivery." },
                ],
            }),
            JSON.stringify({ status: "READY", targetRole: "data analyst", discoveryFacts: {} }),
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
        assert.equal(prompts.length, 3);
        assert.match(prompts[1] ?? "", /review the prior role decision/i);
        assert.match(prompts[1] ?? "", /what about data analyst\?/i);
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
            JSON.stringify({ status: "READY", targetRole: "devops", discoveryFacts: {} }),
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
            JSON.stringify({
                status: "ROLE_OPTIONS",
                summary: "You value strategy, collaboration, and leadership.",
                roles: [
                    { title: "Product Manager", reason: "Connects strategy with cross-functional product ownership." },
                    { title: "Program Manager", reason: "Uses collaboration to coordinate complex initiatives." },
                    { title: "Operations Manager", reason: "Applies leadership to improve teams and processes." },
                ],
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

    it("understands selection of a previously generated role suggestion", async () => {
        const conversation = createDifferentRoleConversation("the first one");
        if (conversation.onboardingFlow?.nearTermTarget) {
            conversation.onboardingFlow.nearTermTarget.suggestedRoles = [
                "Product Manager",
                "Program Manager",
                "Operations Manager",
            ];
        }
        const outputs = [
            JSON.stringify({ status: "READY", targetRole: "Product Manager", discoveryFacts: {} }),
            JSON.stringify({ kind: "GROUNDED_SUGGESTION", evidenceQuote: "the first one" }),
        ];
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

    it("accepts a suggested role title without requiring its description", async () => {
        const conversation = createDifferentRoleConversation("Financial Analyst");
        if (conversation.onboardingFlow?.nearTermTarget) {
            conversation.onboardingFlow.nearTermTarget.suggestedRoles = [
                "Product Manager",
                "Solutions Engineer",
                "Financial Analyst",
            ];
        }
        const outputs = [
            JSON.stringify({ status: "READY", targetRole: "Financial Analyst", discoveryFacts: {} }),
            JSON.stringify({
                kind: "GROUNDED_ROLE",
                evidenceQuote: "Financial Analyst",
                normalizedTargetRole: "Financial Analyst",
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
            latestUserMessage: "Financial Analyst",
            userAccountContext: "Current role / headline: software developer",
            userId: "user-1",
            conversationId: "conversation-1",
        });

        assert.deepEqual(decision, { status: "READY", targetRole: "Financial Analyst", discoveryFacts: {} });
        assert.equal(prompts.length, 2);
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
            JSON.stringify({ status: "READY", targetRole: "product manager" }),
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
            JSON.stringify({ status: "READY", targetRole: "product manager" }),
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

    it("uses a discovery-specific fallback after two invalid model responses", async () => {
        const textCompletion: TextCompletionPort = {
            complete: async () => "not-json",
        };

        const decision = await resolveTargetRoleDecision({
            textCompletion,
            conversation: createDifferentRoleConversation(),
            latestUserMessage: "something different",
            userAccountContext: "Current role / headline: software developer",
            userId: "user-1",
            conversationId: "conversation-1",
        });

        assert.deepEqual(decision, {
            status: "NEEDS_CLARIFICATION",
            question: ONBOARDING_DIFFERENT_ROLE_REPLY,
            subject: "target_direction",
            discoveryFacts: {},
        });
    });
});
