import { mergeRoleExperience } from "../../routes/external-chat-tools/role-experience.utils";
import { toRoleExperienceEntryFromInferred } from "./inference/seniority-inference/seniority-inference.utils";
import { inferAchievementsFromMessage } from "./inference/achievement-inference/achievement-inference.service";
import { inferSeniorityFromMessage } from "./inference/seniority-inference/seniority-inference.service";
import { calculateConfidence } from "./confidence/confidence.service";
import { detectConversationMode } from "./mode-detection/conversation-mode.service";
import {
    conversationHasDreamJobContext,
    hasExplicitFastSearchIntent,
    resolveConversationModeOverride,
    shouldPreferGuidedOverDreamJob,
} from "./mode-detection/conversation-mode.utils";
import { buildUserAccountContext } from "./user-context/chat.user-account-context.utils";
import { detectFollowUpIntent } from "../stage-2-shortcuts/follow-up/job-follow-up-answer.service";
import type { ChatFlowDeps, PrepareSendMessageContextParams, SendMessagePreparedContext } from "../chat-flow.types";
import {
    toSignalUpdateFromInferences,
    updateUserAchievements,
    updateUserRoleExperience,
} from "./prepare-context.utils";

export const runStage1PrepareContext = async (
    deps: ChatFlowDeps,
    params: PrepareSendMessageContextParams
): Promise<SendMessagePreparedContext> => {
    const { userId, normalizedMessage, profile, requestedConversationId, authorization } = params;
    const { conversationId, conversation } = await deps.conversationService.getConversation(
        userId,
        requestedConversationId
    );
    const baseCareerProfile = await deps.profileService.updateProfileFromInput(userId, profile);
    const conversationWithUserMessage = await deps.conversationService.saveUserMessage(
        userId,
        conversation,
        normalizedMessage
    );
    const shouldClearDreamJobFlow =
        (hasExplicitFastSearchIntent(normalizedMessage) || shouldPreferGuidedOverDreamJob(normalizedMessage)) &&
        conversationWithUserMessage.dreamJobFlow !== undefined;
    if (shouldClearDreamJobFlow) {
        await deps.conversationService.updateDreamJobFlow(userId, conversationId, undefined);
    }
    const conversationAfterUserMessage = shouldClearDreamJobFlow
        ? { ...conversationWithUserMessage, dreamJobFlow: undefined }
        : conversationWithUserMessage;

    const serverUser = await deps.externalService.readUserPublicProfile(userId).catch(() => null);
    const userAccountContext = buildUserAccountContext({ serverUser, profile });

    const userAchievements = await deps.externalService.readUserAchievements(userId);
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
    const mode = resolveConversationModeOverride({
        message: normalizedMessage,
        existingDreamJob,
        hasActiveDreamJobFlow: conversationAfterUserMessage.dreamJobFlow !== undefined,
        stickyDreamJobFromHistory:
            conversationHasDreamJobContext(conversationAfterUserMessage.messages) && serverDreamJob === null,
        detectedMode: detectionResult.mode,
    });

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
