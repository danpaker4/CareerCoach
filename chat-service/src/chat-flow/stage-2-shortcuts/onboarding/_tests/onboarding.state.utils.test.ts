import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { defaultOnboardingFlow } from "../../../../routes/conversation/conversation.utils";
import { parseOnboardingLlmDecisionFromJson } from "../onboarding.llm.utils";
import { applyOnboardingDecision } from "../onboarding.state.utils";
import { resolveOnboardingDirectionMode } from "../onboarding.direction.utils";
import { buildBackgroundReviewPrompt, buildOnboardingPrompt } from "../onboarding.prompt.utils";
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
            roleChoice: "DIFFERENT_ROLE",
            targetRole: "frontend developer",
            targetRoleReady: true,
        }));

        assert.equal(decision.background.status, "FOUND");
        assert.equal(decision.background.role, "software developer");
        assert.equal(decision.mode, null);
        assert.equal(decision.advance, true);
        assert.equal(decision.roleChoice, "DIFFERENT_ROLE");
        assert.equal(decision.targetRole, "frontend developer");
        assert.equal(decision.targetRoleReady, true);
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

        assert.match(prompt, /CHAT_STATED_FACTS: yearsOfExperience=5/);
        assert.match(prompt, /CHAT_STATED_FACTS are authoritative/);
        assert.match(prompt, /correct spelling.*natural professional language/i);
        assert.match(prompt, /do not replace or contradict/i);
    });

    it("tells the model to resolve obvious misspellings from conversation context", () => {
        const flow = {
            ...defaultOnboardingFlow(),
            backgroundResolved: true,
            directionResolved: true,
            initialMode: "NEAR_TERM" as const,
            background: { status: "FOUND" as const, role: "software developer" },
            nearTermTarget: { step: "awaiting_role_choice" as const },
        };
        const prompt = buildOnboardingPrompt(
            emptyConversation(),
            "i am thinking about somehting diifererent",
            "",
            flow,
        );

        assert.match(prompt, /obvious spelling mistakes/i);
        assert.match(prompt, /diifererent.*DIFFERENT_ROLE/i);
        assert.match(prompt, /Do not repeat the same-role\/different-role question/i);
    });

    it("omits secondary account data and inactive-stage instructions when chat facts resolve background", () => {
        const prompt = buildOnboardingPrompt(
            emptyConversation(),
            "my name is gal and in the last 5 years im software developer",
            "CV title: QA engineer\nCV contents that should not be sent",
            defaultOnboardingFlow(),
        );

        assert.doesNotMatch(prompt, /CV title|CV contents/);
        assert.doesNotMatch(prompt, /nearTermTarget\.step|discovering_target/);
        assert.match(prompt, /CHAT_STATED_FACTS: yearsOfExperience=5/);
        assert.match(prompt, /Understand role descriptions.*yourself/i);
        assert.ok(prompt.length < 3_000);
    });

    it("asks the model to reject job-search intent misclassified as background", () => {
        const prompt = buildBackgroundReviewPrompt("i am looking for a new role", {
            response: "Are you looking for the same role?",
            background: { status: "FOUND", role: "looking for a new role" },
            mode: null,
            advance: true,
        }, "Current role / headline: QA Automation & Performance Engineer");

        assert.match(prompt, /career intent, not professional background/i);
        assert.match(prompt, /looking for, seeking, wanting/i);
        assert.match(prompt, /i am looking for a new role/i);
        assert.match(prompt, /QA Automation & Performance Engineer/i);
    });

    it("sends only role-choice context while awaiting the near-term role choice", () => {
        const flow = {
            ...defaultOnboardingFlow(),
            backgroundResolved: true,
            directionResolved: true,
            initialMode: "NEAR_TERM" as const,
            background: { status: "FOUND" as const, role: "software developer" },
            nearTermTarget: { step: "awaiting_role_choice" as const },
        };
        const prompt = buildOnboardingPrompt(
            emptyConversation(),
            "differennnt role",
            "Large account and CV context that is irrelevant here",
            flow,
        );

        assert.match(prompt, /roleChoice/);
        assert.match(prompt, /obvious spelling mistakes/i);
        assert.doesNotMatch(prompt, /Large account|Classify background\.status|discovering_target/);
        assert.ok(prompt.length < 1_500);
    });

    it("asks the model for a dynamic first discovery question after choosing a different role", () => {
        const flow = {
            ...defaultOnboardingFlow(),
            backgroundResolved: true,
            directionResolved: true,
            initialMode: "NEAR_TERM" as const,
            background: { status: "FOUND" as const, role: "software developer" },
            nearTermTarget: { step: "awaiting_role_choice" as const },
        };
        const prompt = buildOnboardingPrompt(
            emptyConversation(),
            "i want a different role",
            "Current role / headline: software developer\nCompany: Paragon",
            flow,
        );

        assert.match(prompt, /ask one personalized, high-value discovery question/i);
        assert.match(prompt, /examples rather than a fixed sequence/i);
        assert.match(prompt, /Do not ask for information already known/i);
        assert.match(prompt, /targetDiscoverySubject/);
    });
});

describe("resolveOnboardingDirectionMode", () => {
    it("detects near-term answers used during onboarding", () => {
        assert.equal(resolveOnboardingDirectionMode("im looking for something now"), "NEAR_TERM");
        assert.equal(resolveOnboardingDirectionMode("now"), "NEAR_TERM");
        assert.equal(resolveOnboardingDirectionMode("looking for a job now"), "NEAR_TERM");
        assert.equal(
            resolveOnboardingDirectionMode("i need to change jobs soon, maybe in the next 2 months"),
            "NEAR_TERM",
        );
        assert.equal(resolveOnboardingDirectionMode("I don't know"), "GUIDED");
        assert.equal(resolveOnboardingDirectionMode("still figuring it out"), "GUIDED");
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

    it("ignores a spurious near-term mode when the background message has no job-search intent", () => {
        const expectedReply =
            "You have 5 years of experience as a software developer. Are you looking for a job now, aiming for a longer-term role in the future, or still figuring out what you want?";
        const step = applyOnboardingDecision(
            defaultOnboardingFlow(),
            {
                response: expectedReply,
                background: {
                    status: "FOUND",
                    role: "software developer",
                    yearsOfExperience: 5,
                },
                mode: "NEAR_TERM",
                advance: true,
            },
            "my name is gal kosover and in the last 5 years im software developer",
        );

        assert.match(step.reply, /Are you looking for a job now/i);
        assert.doesNotMatch(step.reply, /same role|different role/i);
        assert.equal(step.onboardingFlow.backgroundResolved, true);
        assert.equal(step.onboardingFlow.directionResolved, false);
        assert.equal(step.onboardingFlow.completed, false);
        assert.equal(step.onboardingFlow.initialMode, undefined);
    });

    it("completes onboarding in one turn when background and near-term intent arrive together", () => {
        const step = applyOnboardingDecision(
            defaultOnboardingFlow(),
            {
                response: "Looking for automation QA roles now.",
                background: { status: "FOUND", role: "automation qa engineer" },
                mode: "NEAR_TERM",
                advance: true,
            },
            "show me jobs for automation qa engineer",
        );
        assert.equal(step.onboardingFlow.completed, true);
        assert.equal(step.onboardingFlow.initialMode, "NEAR_TERM");
        assert.equal(step.completedThisTurn, true);
        assert.match(step.reply, /automation qa engineer/i);
    });

    it("uses the reviewed model role while preserving objective chat tenure", () => {
        const step = applyOnboardingDecision(
            defaultOnboardingFlow(),
            {
                response: "Nice — software developer for about 5 years. Are you looking for a job now?",
                background: {
                    status: "FOUND",
                    role: "software developer",
                    yearsOfExperience: 5,
                    companies: ["IDF"],
                    summary: "software developer for about 5 years at IDF",
                },
                mode: null,
                advance: true,
            },
            "hi my name is gal kosover and in the last 5 years im software developer",
        );

        assert.equal(step.onboardingFlow.backgroundResolved, true);
        assert.equal(step.onboardingFlow.background?.role, "software developer");
        assert.equal(step.onboardingFlow.background?.yearsOfExperience, 5);
        assert.deepEqual(step.onboardingFlow.background?.companies, ["IDF"]);
        assert.equal(step.onboardingFlow.background?.summary, "software developer for about 5 years at IDF");
        assert.equal(
            step.reply,
            "Nice — you have about 5 years of experience as a software developer. Are you looking for a job now, aiming for a longer-term role in the future, or still figuring out what you want?",
        );
    });

    it("uses a normalized acknowledgement instead of echoing the model reply", () => {
        const modelReply = "Great — you have worked as a software developer for 5 years. What kind of role would you like next?";
        const step = applyOnboardingDecision(
            defaultOnboardingFlow(),
            {
                response: modelReply,
                background: {
                    status: "FOUND",
                    role: "software developer",
                    yearsOfExperience: 5,
                },
                mode: null,
                advance: true,
            },
            "in the last 5 years im software developer",
        );

        assert.equal(
            step.reply,
            "Nice — you have about 5 years of experience as a software developer. Are you looking for a job now, aiming for a longer-term role in the future, or still figuring out what you want?",
        );
        assert.equal(step.onboardingFlow.background?.role, "software developer");
        assert.equal(step.onboardingFlow.background?.yearsOfExperience, 5);
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

    it("asks whether a near-term search should use the same or a different role", () => {
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
        assert.equal(step.onboardingFlow.completed, false);
        assert.equal(step.onboardingFlow.initialMode, "NEAR_TERM");
        assert.equal(step.completedThisTurn, false);
        assert.match(step.reply, /same role/i);
        assert.match(step.reply, /different role/i);
        assert.doesNotMatch(step.reply, /You've been/);
    });

    it("searches the current role only after the user chooses the same role", () => {
        const awaitingChoice = {
            ...defaultOnboardingFlow(),
            backgroundResolved: true,
            directionResolved: true,
            initialMode: "NEAR_TERM" as const,
            background: { status: "FOUND" as const, role: "software developer" },
            nearTermTarget: { step: "awaiting_role_choice" as const },
        };
        const step = applyOnboardingDecision(
            awaitingChoice,
            {
                response: "Understood.",
                background: awaitingChoice.background,
                mode: null,
                advance: false,
            },
            "same role",
        );

        assert.equal(step.onboardingFlow.completed, true);
        assert.equal(step.onboardingFlow.nearTermTarget?.roleChoice, "SAME_ROLE");
        assert.equal(step.onboardingFlow.nearTermTarget?.targetRole, "software developer");
        assert.equal(step.completedThisTurn, true);
    });

    it("recognizes a misspelled different-role choice when the model is uncertain", () => {
        const awaitingChoice = {
            ...defaultOnboardingFlow(),
            backgroundResolved: true,
            directionResolved: true,
            initialMode: "NEAR_TERM" as const,
            background: { status: "FOUND" as const, role: "software developer" },
            nearTermTarget: { step: "awaiting_role_choice" as const },
        };
        const step = applyOnboardingDecision(
            awaitingChoice,
            {
                response: "Are you looking for the same role or a different role?",
                background: awaitingChoice.background,
                mode: null,
                advance: false,
                roleChoice: null,
            },
            "differennnt role",
        );

        assert.equal(step.onboardingFlow.completed, false);
        assert.equal(step.onboardingFlow.nearTermTarget?.step, "discovering_target");
        assert.equal(step.onboardingFlow.nearTermTarget?.roleChoice, "DIFFERENT_ROLE");
        assert.match(step.reply, /what role or kind of work/i);
    });

    it("keeps asking about a different role until a concrete target is understood", () => {
        const awaitingChoice = {
            ...defaultOnboardingFlow(),
            backgroundResolved: true,
            directionResolved: true,
            initialMode: "NEAR_TERM" as const,
            background: { status: "FOUND" as const, role: "software developer" },
            nearTermTarget: { step: "awaiting_role_choice" as const },
        };
        const choseDifferent = applyOnboardingDecision(
            awaitingChoice,
            {
                response: "Which parts of software development have you enjoyed most?",
                background: awaitingChoice.background,
                mode: null,
                advance: false,
                roleChoice: "DIFFERENT_ROLE",
                targetDiscoverySubject: "enjoyed_work",
            },
            "a different role",
        );
        assert.equal(choseDifferent.onboardingFlow.completed, false);
        assert.equal(choseDifferent.onboardingFlow.nearTermTarget?.step, "discovering_target");
        assert.match(choseDifferent.reply, /parts of software development/i);
        assert.deepEqual(choseDifferent.onboardingFlow.nearTermTarget?.coveredSubjects, ["enjoyed_work"]);

        const stillDiscovering = applyOnboardingDecision(
            choseDifferent.onboardingFlow,
            {
                response: "Would you rather build user interfaces, APIs, or mobile applications?",
                background: awaitingChoice.background,
                mode: null,
                advance: false,
                targetRoleReady: false,
                targetDiscoverySubject: "product_area",
                targetDiscoveryFacts: { enjoyed_work: "building products" },
            },
            "I want to build products",
        );
        assert.equal(stillDiscovering.onboardingFlow.completed, false);
        assert.equal(stillDiscovering.onboardingFlow.nearTermTarget?.clarificationCount, 2);
        assert.match(stillDiscovering.reply, /interfaces, APIs, or mobile applications\?/i);
        assert.equal(stillDiscovering.onboardingFlow.nearTermTarget?.discoveryFacts?.enjoyed_work, "building products");

        const withOptions = applyOnboardingDecision(
            stillDiscovering.onboardingFlow,
            {
                response: "Would Product Manager, Program Manager, or Operations Manager be closest?",
                background: awaitingChoice.background,
                mode: null,
                advance: false,
                targetRoleOptions: ["Product Manager", "Program Manager", "Operations Manager"],
            },
            "I really don't know",
        );
        assert.deepEqual(withOptions.onboardingFlow.nearTermTarget?.suggestedRoles, [
            "Product Manager",
            "Program Manager",
            "Operations Manager",
        ]);

        const understood = applyOnboardingDecision(
            withOptions.onboardingFlow,
            {
                response: "Frontend developer sounds like the target.",
                background: awaitingChoice.background,
                mode: null,
                advance: true,
                targetRole: "frontend developer",
                targetRoleReady: true,
            },
            "frontend developer",
        );
        assert.equal(understood.onboardingFlow.completed, true);
        assert.equal(understood.onboardingFlow.nearTermTarget?.targetRole, "frontend developer");
        assert.equal(understood.completedThisTurn, true);
    });

    it("keeps onboarding open while presenting role options", () => {
        const discoveringTarget = {
            ...defaultOnboardingFlow(),
            backgroundResolved: true,
            directionResolved: true,
            initialMode: "NEAR_TERM" as const,
            background: { status: "FOUND" as const, role: "software developer" },
            nearTermTarget: {
                step: "discovering_target" as const,
                roleChoice: "DIFFERENT_ROLE" as const,
                clarificationCount: 3,
            },
        };
        const step = applyOnboardingDecision(
            discoveringTarget,
            {
                response: [
                    "These directions fit the preferences you shared.",
                    "1. Product Manager — Combines technical context with product ownership.",
                    "2. Program Manager — Focuses on delivery across multiple teams.",
                    "3. Solutions Engineer — Applies technical skills to customer problems.",
                    "Which role feels closest, or do none of them fit?",
                ].join("\n"),
                background: discoveringTarget.background,
                mode: null,
                advance: false,
                targetRoleOptions: ["Product Manager", "Program Manager", "Solutions Engineer"],
            },
            "are there any relevant jobs?",
        );

        assert.equal(step.onboardingFlow.completed, false);
        assert.equal(step.onboardingFlow.nearTermTarget?.searchQuery, undefined);
        assert.deepEqual(step.onboardingFlow.nearTermTarget?.suggestedRoles, [
            "Product Manager",
            "Program Manager",
            "Solutions Engineer",
        ]);
        assert.match(step.reply, /1\. Product Manager/);
    });

    it("rejects the old direction question while discovering a different target role", () => {
        const discoveringTarget = {
            ...defaultOnboardingFlow(),
            backgroundResolved: true,
            directionResolved: true,
            initialMode: "NEAR_TERM" as const,
            background: { status: "FOUND" as const, role: "software developer" },
            nearTermTarget: {
                step: "discovering_target" as const,
                roleChoice: "DIFFERENT_ROLE" as const,
            },
        };
        const step = applyOnboardingDecision(
            discoveringTarget,
            {
                response: ONBOARDING_DIRECTION_REASK_REPLY,
                background: discoveringTarget.background,
                mode: null,
                advance: false,
                targetRoleReady: false,
            },
            "product manager",
        );

        assert.equal(step.onboardingFlow.completed, false);
        assert.doesNotMatch(step.reply, /looking for a job now/i);
        assert.match(step.reply, /role or kind of work/i);
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
