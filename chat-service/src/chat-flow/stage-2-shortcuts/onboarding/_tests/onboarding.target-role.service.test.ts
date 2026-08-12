import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Conversation } from "../../../../routes/conversation/conversation.model";
import type { TextCompletionPort } from "../../../../litellm/text-completion/text-completion.types";
import {
    parseTargetRoleDecision,
    parseTargetRoleGroundingDecision,
} from "../onboarding.target-role.llm.utils";
import { resolveTargetRoleDecision } from "../onboarding.target-role.service";
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

        assert.deepEqual(decision, { status: "READY", targetRole: "product manager" });
    });

    it("rejects a question from an already completed onboarding stage", () => {
        const decision = parseTargetRoleDecision(JSON.stringify({
            status: "NEEDS_CLARIFICATION",
            question: ONBOARDING_DIRECTION_REASK_REPLY,
        }));

        assert.equal(decision, null);
    });
});

describe("parseTargetRoleGroundingDecision", () => {
    it("requires an exact user quote containing the proposed role", () => {
        const grounded = parseTargetRoleGroundingDecision(JSON.stringify({
            kind: "GROUNDED_ROLE",
            evidenceQuote: "product manager",
        }), "product manager", "I want to be a product manager");
        const inferred = parseTargetRoleGroundingDecision(JSON.stringify({
            kind: "GROUNDED_ROLE",
            evidenceQuote: "leading teams",
        }), "product manager", "leading teams");

        assert.deepEqual(grounded, { kind: "GROUNDED_ROLE", evidenceQuote: "product manager" });
        assert.equal(inferred, null);
    });
});

describe("resolveTargetRoleDecision", () => {
    it("switches from open questions to model-generated role choices after the limit", async () => {
        const conversation = createDifferentRoleConversation("i really don't know");
        if (conversation.onboardingFlow?.nearTermTarget) {
            conversation.onboardingFlow.nearTermTarget.clarificationCount = 2;
        }
        const outputs = [
            JSON.stringify({ status: "NEEDS_CLARIFICATION", question: "What kind of work sounds appealing?" }),
            JSON.stringify({
                status: "ROLE_OPTIONS",
                response: "You value strategy, collaboration, and leadership. Which is closest: Product Manager, Program Manager, or Operations Manager?",
                roles: ["Product Manager", "Program Manager", "Operations Manager"],
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
            userId: "user-1",
            conversationId: "conversation-1",
        });

        assert.equal(decision.status, "ROLE_OPTIONS");
        assert.equal(prompts.length, 2);
        assert.match(prompts[0] ?? "", /mustOfferChoices=true/);
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
            JSON.stringify({ status: "READY", targetRole: "Product Manager" }),
            JSON.stringify({ kind: "GROUNDED_SUGGESTION", evidenceQuote: "the first one" }),
        ];
        const textCompletion: TextCompletionPort = {
            complete: async () => outputs.shift() ?? "",
        };

        const decision = await resolveTargetRoleDecision({
            textCompletion,
            conversation,
            latestUserMessage: "the first one",
            userId: "user-1",
            conversationId: "conversation-1",
        });

        assert.deepEqual(decision, { status: "READY", targetRole: "Product Manager" });
    });

    it("allows an explicitly requested exploratory job search after preference discovery", async () => {
        const conversation = createDifferentRoleConversation("are there any relevant jobs?");
        if (conversation.onboardingFlow?.nearTermTarget) {
            conversation.onboardingFlow.nearTermTarget.clarificationCount = 3;
        }
        const textCompletion: TextCompletionPort = {
            complete: async () => JSON.stringify({
                status: "EXPLORE",
                roles: ["Product Manager", "Program Manager", "Operations Manager"],
            }),
        };

        const decision = await resolveTargetRoleDecision({
            textCompletion,
            conversation,
            latestUserMessage: "are there any relevant jobs?",
            userId: "user-1",
            conversationId: "conversation-1",
        });

        assert.deepEqual(decision, {
            status: "EXPLORE",
            response: "I'll show exploratory matches across Product Manager, Program Manager, Operations Manager.",
            searchQuery: "Product Manager Program Manager Operations Manager",
        });
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
            userId: "user-1",
            conversationId: "conversation-1",
        });

        assert.deepEqual(decision, {
            status: "NEEDS_CLARIFICATION",
            question: "Would you prefer to lead an engineering team, own product direction, or manage projects?",
        });
        assert.equal(prompts.length, 2);
        assert.match(prompts[1] ?? "", /concrete searchable occupational title/i);
    });

    it("retries a wrong-stage response and understands the target role from the chat", async () => {
        const outputs = [
            JSON.stringify({ status: "NEEDS_CLARIFICATION", question: ONBOARDING_DIRECTION_REASK_REPLY }),
            JSON.stringify({ status: "READY", targetRole: "product manager" }),
            JSON.stringify({ kind: "GROUNDED_ROLE", evidenceQuote: "product manager" }),
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
            userId: "user-1",
            conversationId: "conversation-1",
        });

        assert.deepEqual(decision, { status: "READY", targetRole: "product manager" });
        assert.equal(prompts.length, 3);
        assert.match(prompts[0] ?? "", /Latest user message: product manager/);
        assert.match(prompts[1] ?? "", /previous output was invalid/i);
        assert.match(prompts[2] ?? "", /concrete searchable occupational title/i);
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
            userId: "user-1",
            conversationId: "conversation-1",
        });

        assert.deepEqual(decision, {
            status: "NEEDS_CLARIFICATION",
            question: ONBOARDING_DIFFERENT_ROLE_REPLY,
        });
    });
});
