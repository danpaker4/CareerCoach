import type { CareerProfileSignalUpdate } from "../../routes/career-profile/career-profile.types";
import { mergeRoleExperience } from "../../routes/external-chat-tools/role-experience.utils";
import { toRoleExperienceEntryFromInferred } from "./inference/seniority-inference/seniority-inference.utils";
import { toUserAchievementFromInferred } from "./inference/achievement-inference/achievement-inference.utils";
import { inferAchievementsFromMessage } from "./inference/achievement-inference/achievement-inference.service";
import { inferSeniorityFromMessage } from "./inference/seniority-inference/seniority-inference.service";
import { calculateConfidence } from "./confidence/confidence.service";
import { detectConversationMode } from "./mode-detection/conversation-mode.service";
import { shouldEnterDreamJobMode, conversationHasDreamJobContext } from "./mode-detection/conversation-mode.utils";
import { buildUserAccountContext } from "./user-context/chat.user-account-context.utils";
import { detectFollowUpIntent } from "../stage-2-shortcuts/follow-up/job-follow-up-answer.service";
import { toSignal } from "../api/shared/chat.utils";
import type { ChatFlowDeps, PrepareSendMessageContextParams, SendMessagePreparedContext } from "../chat-flow.types";
import type { AchievementInferenceResult } from "./inference/achievement-inference/achievement-inference.types";
import type { RoleExperienceEntry } from "../../routes/external-chat-tools/role-experience.types";

const toSignalUpdateFromInferences = (
    message: string,
    achievementSkills: readonly string[],
    inferredSkills: readonly string[]
): CareerProfileSignalUpdate => ({
    strengths: inferredSkills.map((skill) => toSignal(skill, 0.7, message, "llm_inference")),
    technologies: achievementSkills.map((skill) => toSignal(skill, 0.86, message, "chat")),
    extractedKeywords: [...achievementSkills, ...inferredSkills]
        .map((keyword) => toSignal(keyword, 0.6, message, "llm_inference")),
});

const updateUserAchievements = async (
    deps: ChatFlowDeps,
    userId: string,
    achievementInference: AchievementInferenceResult
): Promise<void> => {
    await deps.externalService
        .applyInferredAchievementSignals(userId, {
            technologies: achievementInference.skills,
            knownSkills: achievementInference.inferredSkills,
            achievements: achievementInference.achievements.map(toUserAchievementFromInferred),
        })
        .catch(() => null);
};

const updateUserRoleExperience = async (
    deps: ChatFlowDeps,
    userId: string,
    roleExperience: readonly RoleExperienceEntry[]
): Promise<void> => {
    await deps.externalService.applyInferredRoleExperience(userId, { roleExperience }).catch(() => null);
};

export const runStage1PrepareContext = async (
    deps: ChatFlowDeps,
    params: PrepareSendMessageContextParams
): Promise<SendMessagePreparedContext> => {
    const { userId, normalizedMessage, profile, requestedConversationId, authorization } = params;
    const { conversationId } = await deps.conversationService.ensureConversationExists(userId, requestedConversationId);
    await deps.profileService.updateProfileFromInput(userId, profile);
    await deps.conversationService.appendUserMessage(userId, conversationId, normalizedMessage);

    const serverUser = await deps.externalService.readUserPublicProfile(userId).catch(() => null);
    const userAccountContext = buildUserAccountContext({ serverUser, profile });

    const conversationAfterUserMessage = await deps.conversationService.getConversationOrThrow(userId, conversationId);
    const userAchievements = await deps.externalService.readUserAchievements(userId);
    const baseCareerProfile = await deps.profileService.getOrCreateProfile(userId);
    const achievementInference = inferAchievementsFromMessage(normalizedMessage);
    const seniorityInference = inferSeniorityFromMessage(normalizedMessage);
    const inferredRoleExperience = seniorityInference.entries.map(toRoleExperienceEntryFromInferred);
    const existingRoleExperience = await deps.externalService.readUserRoleExperience(userId);
    const inferredSignalUpdate = toSignalUpdateFromInferences(
        normalizedMessage,
        achievementInference.skills,
        achievementInference.inferredSkills
    );
    const userCareerProfile = await deps.profileService.mergeProfileSignals(baseCareerProfile, inferredSignalUpdate);
    await updateUserAchievements(deps, userId, achievementInference);
    await updateUserRoleExperience(deps, userId, inferredRoleExperience);
    const userRoleExperience = mergeRoleExperience(existingRoleExperience, inferredRoleExperience);
    const confidenceSummary = calculateConfidence(userCareerProfile, userRoleExperience);
    const detectionResult = await detectConversationMode(
        deps.textCompletion,
        conversationAfterUserMessage,
        normalizedMessage,
        userAchievements,
        userAccountContext
    );
    const serverDreamJob = typeof serverUser?.dreamJob === "string" ? serverUser.dreamJob : null;
    const existingDreamJob = conversationAfterUserMessage.dreamJobFlow?.proposedTitle ?? serverDreamJob;
    const isDreamJobRule = shouldEnterDreamJobMode(normalizedMessage, existingDreamJob) ||
        conversationAfterUserMessage.dreamJobFlow !== undefined ||
        (conversationHasDreamJobContext(conversationAfterUserMessage.messages) && serverDreamJob === null);
    const mode = isDreamJobRule ? "DREAMJOB" : detectionResult.mode;

    const followUpIntent = detectFollowUpIntent(normalizedMessage);
    const jobContext = conversationAfterUserMessage.jobContext;
    return {
        userId,
        conversationId,
        normalizedMessage,
        profile,
        userAchievements,
        userAccountContext,
        conversationAfterUserMessage,
        userCareerProfile,
        userRoleExperience,
        confidenceSummary,
        mode,
        fastSearchQuery: detectionResult.fastSearchQuery,
        followUpIntent,
        jobContext,
        authorization,
    };
};
