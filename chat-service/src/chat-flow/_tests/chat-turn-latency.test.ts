import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ObjectId } from "mongodb";
import type { ChatFlowDeps } from "../chat-flow.types";
import { sendMessage } from "../send-message";
import type { UserCareerProfile } from "../../routes/career-profile/career-profile.types";
import type { Conversation } from "../../routes/conversation/conversation.types";
import type { TextCompletionPort } from "../../litellm/text-completion/text-completion.types";

const createCareerProfile = (userId: string): UserCareerProfile => {
    const now = new Date(0);
    return {
        userId,
        strengths: [],
        weakSignals: [],
        preferredRoles: [],
        dislikedRoles: [],
        preferredDomains: [],
        dislikedDomains: [],
        technologies: [],
        softSkills: [],
        motivations: [],
        interests: [],
        dislikes: [],
        workStyle: [],
        personalitySignals: [],
        longTermGoals: [],
        shortTermGoals: [],
        extractedKeywords: [],
        salaryExpectation: null,
        locationPreference: null,
        remotePreference: null,
        senioritySignal: null,
        uncertaintyLevel: 0.5,
        profileSummaryText: "",
        profileSummaryEmbedding: [],
        createdAt: now,
        updatedAt: now,
    };
};

const createChatFlowHarness = (
    userId: string,
    complete: TextCompletionPort["complete"]
): { readonly deps: ChatFlowDeps; readonly conversationId: ObjectId } => {
    const conversationId = new ObjectId();
    const now = new Date(0);
    const conversation: Conversation = {
        _id: conversationId,
        userId,
        messages: [{ role: "assistant", content: "Tell me about your background.", timestamp: now }],
        stageProgress: {
            currentStageIndex: 0,
            currentStageId: "achievements",
            completedStageIds: [],
            awaitingConfirmation: false,
            stageNotes: {},
        },
        createdAt: now,
        updatedAt: now,
    };
    const careerProfile = createCareerProfile(userId);
    const deps = {
        conversationService: {
            getConversation: async () => ({
                conversationId: conversationId.toHexString(),
                conversation,
            }),
            saveUserMessage: async (_savedUserId: string, currentConversation: Conversation, content: string) => ({
                ...currentConversation,
                messages: [...currentConversation.messages, { role: "user" as const, content, timestamp: now }],
            }),
            appendAssistantMessage: async () => undefined,
            updateQuickHelpFlow: async () => undefined,
            updateStageProgress: async () => undefined,
        },
        profileService: {
            updateProfileFromInput: async () => careerProfile,
            mergeProfileSignals: async () => careerProfile,
        },
        externalService: {
            readUserPublicProfile: async () => null,
            readUserAchievements: async () => [],
            readUserRoleExperience: async () => [],
            applyInferredAchievementSignals: async () => undefined,
        },
        textCompletion: { complete },
        jobServiceBaseUrl: "http://127.0.0.1:3003",
        dreamJobRoadmapCreator: {
            create: async () => ({ created: true }),
        },
        suggestDirections: async () => [],
    } as unknown as ChatFlowDeps;

    return { deps, conversationId };
};

describe("sendMessage latency regression", () => {
    it("answers a deterministic skills-gap prompt when the LLM is unavailable", async () => {
        const userId = "skills-shortcut-test-user";
        const { deps } = createChatFlowHarness(userId, async () => {
            throw new Error("LLM should not be required for a deterministic shortcut");
        });

        const response = await sendMessage(deps, userId, "What skills should I learn for my next role?");

        assert.equal(
            response.reply,
            "Which role are you aiming for next? Share the job title (for example: Frontend Engineer, QA Automation, Product Manager)."
        );
        assert.equal(response.mode, "SKILLS_GAP");
    });

    it("redirects a clearly off-topic prompt when the LLM is unavailable", async () => {
        const userId = "off-topic-shortcut-test-user";
        const { deps } = createChatFlowHarness(userId, async () => {
            throw new Error("LLM should not be required for a deterministic shortcut");
        });

        const response = await sendMessage(deps, userId, "I need to poop");

        assert.equal(
            response.reply,
            "I can help with career planning, job searches, CVs, interviews, and skills. What career question would you like to work on?"
        );
        assert.equal(response.mode, "GUIDED");
    });

    it("uses a stage-specific reply when the model decision violates its schema", async () => {
        const userId = "invalid-decision-test-user";
        const invalidDecision = JSON.stringify({
            r: "Malformed decision",
            m: "D",
            ready: false,
            target: { title: "Chief Executive Officer" },
            advance: false,
            search: false,
            skills: [],
            interests: [],
            level: "",
            keywords: [],
        });
        const { deps } = createChatFlowHarness(userId, async () => invalidDecision);

        const response = await sendMessage(deps, userId, "I built a TypeScript API.");

        assert.equal(
            response.reply,
            "What project, responsibility, or accomplishment best shows what you can do?"
        );
        assert.equal(response.mode, "GUIDED");
    });

    it("uses one LLM completion for a normal guided turn", async () => {
        const userId = "latency-test-user";
        const completionPrompts: string[] = [];
        const completionResponse = JSON.stringify({
            r: "What project are you most proud of?",
            m: "G",
            ready: false,
            target: null,
            advance: false,
            search: false,
            skills: [],
            interests: [],
            level: "",
            keywords: [],
        });
        const { deps } = createChatFlowHarness(userId, async (prompt) => {
            completionPrompts.push(prompt.userPrompt);
            return completionResponse;
        });

        const response = await sendMessage(deps, userId, "I built a TypeScript API.");

        assert.equal(response.reply, "What project are you most proud of?");
        assert.equal(completionPrompts.length, 1);
    });
});
