import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ChatFlowDeps, SendMessageBaseContext } from "../../../chat-flow.types";
import { createEmptyProfileSignals } from "../../../../routes/career-profile/signals/career-profile.signals.utils";
import type { JobSearchPlan } from "../../../stage-5-job-search/search-plan/job-search-plan.types";
import { runOnboardingFlow } from "../onboarding-flow";

describe("runOnboardingFlow", () => {
    it("searches jobs immediately when the user selects a saved role", async () => {
        const latestUserMessage = "UI/UX Designer sounds great";
        const searchQueries: string[] = [];
        const appendedReplies: string[] = [];
        const deps = {
            conversationService: {
                updateOnboardingFlow: async () => undefined,
                updateStageProgress: async () => undefined,
                appendAssistantMessage: async (_userId: string, _conversationId: string, reply: string) => {
                    appendedReplies.push(reply);
                },
            } as unknown as ChatFlowDeps["conversationService"],
            externalService: {
                searchJobsByPlan: async (plan: JobSearchPlan) => {
                    searchQueries.push(...plan.searches.map((search) => search.query));
                    return [];
                },
            } as unknown as ChatFlowDeps["externalService"],
            profileService: {} as ChatFlowDeps["profileService"],
            textCompletion: {
                complete: async () => JSON.stringify({
                    verdict: "SELECTED",
                    targetRole: "UI/UX Designer",
                    evidenceQuote: latestUserMessage,
                }),
            },
            jobServiceBaseUrl: "http://job-service.test",
            dreamJobRoadmapCreator: {
                create: async () => ({ created: false as const, reason: "generation_failed" as const }),
            },
            suggestDirections: async () => [],
        } satisfies ChatFlowDeps;
        const now = new Date(0);
        const ctx = {
            userId: "user-1",
            conversationId: "conversation-1",
            normalizedMessage: latestUserMessage,
            profile: undefined,
            userAchievements: [],
            userAccountContext: "Name: shai",
            conversationAfterUserMessage: {
                userId: "user-1",
                messages: [
                    {
                        role: "assistant" as const,
                        content: "1. UI/UX Designer\n2. Web Developer\n3. Graphic Designer\nWhich role feels closest?",
                        timestamp: now,
                    },
                    { role: "user" as const, content: latestUserMessage, timestamp: now },
                ],
                stageProgress: { currentStageIndex: 0, awaitingConfirmation: false, stageNotes: {} },
                onboardingFlow: {
                    started: true as const,
                    backgroundResolved: true,
                    backgroundAskCount: 1,
                    directionResolved: true,
                    directionAskCount: 1,
                    completed: false,
                    initialMode: "NEAR_TERM" as const,
                    background: { status: "NONE" as const, role: null },
                    nearTermTarget: {
                        step: "discovering_target" as const,
                        suggestedRoles: ["UI/UX Designer", "Web Developer", "Graphic Designer"],
                    },
                },
                createdAt: now,
                updatedAt: now,
            },
            userCareerProfile: {
                userId: "user-1",
                ...createEmptyProfileSignals(),
                salaryExpectation: null,
                locationPreference: null,
                remotePreference: null,
                senioritySignal: null,
                uncertaintyLevel: 0,
                profileSummaryText: "",
                profileSummaryEmbedding: [],
                createdAt: now,
                updatedAt: now,
            },
            userRoleExperience: [],
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
        } satisfies SendMessageBaseContext;

        const response = await runOnboardingFlow(deps, ctx);

        assert.ok(searchQueries.some((query) => query.toLowerCase().includes("ui/ux designer")));
        assert.match(response.reply, /searched for UI\/UX Designer roles/i);
        assert.equal(appendedReplies[0], "Got it — I'll look for UI/UX Designer roles you can move into soon.");
    });
});
