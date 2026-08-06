import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ObjectId } from "mongodb";
import type { ChatFlowDeps } from "../chat-flow.types";
import { sendMessage } from "../send-message";
import type { UserCareerProfile } from "../../routes/career-profile/career-profile.types";
import type { Conversation } from "../../routes/conversation/conversation.types";

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

describe("sendMessage latency regression", () => {
    it("uses one LLM completion for a normal guided turn", async () => {
        const userId = "latency-test-user";
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
            textCompletion: {
                complete: async (prompt: string) => {
                    completionPrompts.push(prompt);
                    return completionResponse;
                },
            },
            jobServiceBaseUrl: "http://127.0.0.1:3003",
            dreamJobRoadmapCreator: {
                create: async () => ({ created: true }),
            },
            suggestDirections: async () => [],
        } as unknown as ChatFlowDeps;

        const response = await sendMessage(deps, userId, "I built a TypeScript API.");

        assert.equal(response.reply, "What project are you most proud of?");
        assert.equal(completionPrompts.length, 1);
    });
});
