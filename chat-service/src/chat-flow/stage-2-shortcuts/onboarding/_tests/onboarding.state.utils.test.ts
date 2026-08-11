import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { defaultOnboardingFlow } from "../../../../routes/conversation/conversation.utils";
import { parseOnboardingLlmDecisionFromJson } from "../onboarding.llm.utils";
import { applyOnboardingDecision } from "../onboarding.state.utils";
import { resolveOnboardingDirectionMode } from "../onboarding.direction.utils";
import { buildOnboardingPrompt } from "../onboarding.prompt.utils";
import { ONBOARDING_DIRECTION_REASK_REPLY } from "../onboarding.types";
import type { Conversation } from "../../../../routes/conversation/conversation.model";

const emptyConversation = (): Conversation => ({
    userId: "user-1",
    messages: [],
    stageProgress: {
        currentStageIndex: 0,
        awaitingConfirmation: false,
        stageNotes: {},
    },
    onboardingFlow: defaultOnboardingFlow(),
    createdAt: new Date(0),
    updatedAt: new Date(0),
});

describe("parseOnboardingLlmDecisionFromJson", () => {
    it("parses structured onboarding payloads", () => {
        const decision = parseOnboardingLlmDecisionFromJson(JSON.stringify({
            response: "I see you are a software developer. What are you looking for?",
            background: {
                status: "FOUND",
                role: "software developer",
                yearsOfExperience: 5,
                companies: [],
                technologies: ["TypeScript"],
                education: [],
                summary: "Software developer for 5 years",
            },
            mode: null,
            advance: true,
        }));

        assert.equal(decision.background.status, "FOUND");
        assert.equal(decision.background.role, "software developer");
        assert.equal(decision.mode, null);
        assert.equal(decision.advance, true);
    });

    it("falls back safely on invalid JSON", () => {
        assert.throws(() => parseOnboardingLlmDecisionFromJson("not-json"));
    });

    it("rewrites leaked internal mode labels into a readable direction question", () => {
        const decision = parseOnboardingLlmDecisionFromJson(JSON.stringify({
            response:
                "Hi Gal Kosover! With over 2 years of experience as a QA Automation & Performance Engineer, you've built scalable test automation frameworks. You're now looking to [NEAR_TERM|DREAMJOB|GUIDED]. Which direction would you like to take?",
            background: { status: "FOUND", role: "QA Automation & Performance Engineer" },
            mode: null,
            advance: true,
        }));

        assert.doesNotMatch(decision.response, /NEAR_TERM|DREAMJOB|GUIDED|\[/);
        assert.match(decision.response, /looking for a job now/i);
    });
});

describe("buildOnboardingPrompt", () => {
    it("injects CHAT_STATED_FACTS and prefer-chat rules when the user states role/years", () => {
        const prompt = buildOnboardingPrompt(
            emptyConversation(),
            "hi my name is gal kosover and in the last 5 years im qa",
            "Current role / headline: QA Automation & Performance Engineer\nCompany: IDF",
            defaultOnboardingFlow(),
        );

        assert.match(prompt, /CHAT_STATED_FACTS \(authoritative for role\/years\): role=qa, yearsOfExperience=5/);
        assert.match(prompt, /CHAT_STATED_FACTS are authoritative for role and yearsOfExperience/);
        assert.match(prompt, /Never replace chat-stated role wording or years with a CV title\/tenure variant/);
    });
});

describe("resolveOnboardingDirectionMode", () => {
    it("detects near-term answers used during onboarding", () => {
        assert.equal(resolveOnboardingDirectionMode("im looking for something now"), "NEAR_TERM");
        assert.equal(resolveOnboardingDirectionMode("now"), "NEAR_TERM");
        assert.equal(resolveOnboardingDirectionMode("I don't know"), "GUIDED");
    });
});

describe("applyOnboardingDecision", () => {
    it("resolves FOUND background without completing onboarding yet", () => {
        const step = applyOnboardingDecision(defaultOnboardingFlow(), {
            response: "Summary + direction?",
            background: { status: "FOUND", role: "software developer" },
            mode: null,
            advance: true,
        });
        assert.equal(step.onboardingFlow.backgroundResolved, true);
        assert.equal(step.onboardingFlow.completed, false);
        assert.equal(step.completedThisTurn, false);
        assert.equal(step.onboardingFlow.background?.role, "software developer");
    });

    it("prefers chat role and years over CV-shaped LLM background", () => {
        const step = applyOnboardingDecision(
            defaultOnboardingFlow(),
            {
                response: "Nice — QA Automation & Performance Engineer for about 2 years at IDF. Looking for a job now?",
                background: {
                    status: "FOUND",
                    role: "QA Automation & Performance Engineer",
                    yearsOfExperience: 2,
                    companies: ["IDF"],
                    summary: "QA Automation & Performance Engineer for about 2 years at IDF",
                },
                mode: null,
                advance: true,
            },
            "hi my name is gal kosover and in the last 5 years im qa",
        );

        assert.equal(step.onboardingFlow.backgroundResolved, true);
        assert.equal(step.onboardingFlow.background?.role, "qa");
        assert.equal(step.onboardingFlow.background?.yearsOfExperience, 5);
        assert.deepEqual(step.onboardingFlow.background?.companies, ["IDF"]);
        assert.equal(step.onboardingFlow.background?.summary, "qa for about 5 years at IDF");
    });

    it("resolves NONE background and skips re-ask", () => {
        const step = applyOnboardingDecision(defaultOnboardingFlow(), {
            response: "No experience yet. What are you looking for?",
            background: { status: "NONE" },
            mode: null,
            advance: true,
        });
        assert.equal(step.onboardingFlow.backgroundResolved, true);
        assert.equal(step.onboardingFlow.backgroundAskCount, 0);
    });

    it("re-asks once for UNKNOWN background then proceeds with a short direction question", () => {
        const first = applyOnboardingDecision(defaultOnboardingFlow(), {
            response: "Can you share your background?",
            background: { status: "UNKNOWN" },
            mode: null,
            advance: false,
        });
        assert.equal(first.onboardingFlow.backgroundAskCount, 1);
        assert.equal(first.onboardingFlow.backgroundResolved, false);

        const second = applyOnboardingDecision(first.onboardingFlow, {
            response: "Let's talk about what you want next.",
            background: { status: "UNKNOWN" },
            mode: null,
            advance: false,
        });
        assert.equal(second.onboardingFlow.backgroundResolved, true);
        assert.equal(second.reply, ONBOARDING_DIRECTION_REASK_REPLY);
    });

    it("completes with NEAR_TERM from message even when LLM mode is null", () => {
        const afterBackground = applyOnboardingDecision(defaultOnboardingFlow(), {
            response: "Direction?",
            background: { status: "FOUND", role: "software developer" },
            mode: null,
            advance: true,
        }).onboardingFlow;

        const step = applyOnboardingDecision(
            afterBackground,
            {
                response: "You've been a software developer... Are you looking for a job now?",
                background: { status: "FOUND", role: "software developer" },
                mode: null,
                advance: false,
            },
            "im looking for something now",
        );
        assert.equal(step.onboardingFlow.completed, true);
        assert.equal(step.onboardingFlow.initialMode, "NEAR_TERM");
        assert.equal(step.completedThisTurn, true);
        assert.match(step.reply, /look for software developer roles/i);
        assert.doesNotMatch(step.reply, /You've been/);
    });

    it("uses a short direction re-ask instead of repeating biography", () => {
        const readyForDirection = {
            ...defaultOnboardingFlow(),
            backgroundResolved: true,
            background: { status: "FOUND" as const, role: "developer" },
        };

        const first = applyOnboardingDecision(readyForDirection, {
            response: "You've been a developer for years. Which direction?",
            background: { status: "FOUND", role: "developer" },
            mode: null,
            advance: false,
        }, "maybe");
        assert.equal(first.reply, ONBOARDING_DIRECTION_REASK_REPLY);
        assert.equal(first.onboardingFlow.directionAskCount, 1);
    });

    it("forces GUIDED after two unclear direction answers", () => {
        const readyForDirection = {
            ...defaultOnboardingFlow(),
            backgroundResolved: true,
            background: { status: "FOUND" as const, role: "developer" },
        };

        const first = applyOnboardingDecision(readyForDirection, {
            response: "Near-term, dream, or unsure?",
            background: { status: "FOUND", role: "developer" },
            mode: null,
            advance: false,
        }, "hmm");
        assert.equal(first.onboardingFlow.directionAskCount, 1);
        assert.equal(first.onboardingFlow.completed, false);

        const second = applyOnboardingDecision(first.onboardingFlow, {
            response: "We can explore together.",
            background: { status: "FOUND", role: "developer" },
            mode: null,
            advance: false,
        }, "ok");
        assert.equal(second.onboardingFlow.completed, true);
        assert.equal(second.onboardingFlow.initialMode, "GUIDED");
        assert.equal(second.completedThisTurn, true);
        assert.match(second.reply, /figure out the best direction/i);
    });
});
