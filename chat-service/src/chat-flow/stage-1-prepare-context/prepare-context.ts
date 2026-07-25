import { inferAchievementsFromMessage } from "./inference/achievement-inference/achievement-inference.service";
import { calculateConfidence } from "./confidence/confidence.service";
import { buildUserAccountContext } from "./user-context/chat.user-account-context.utils";
import { detectFollowUpIntent } from "../stage-2-shortcuts/follow-up/job-follow-up-answer.service";
import type { ChatFlowDeps, PrepareSendMessageContextParams, SendMessageBaseContext } from "../chat-flow.types";
import { toSignalUpdateFromInferences, updateUserAchievements } from "./prepare-context.utils";

export const runStage1PrepareContext = async (
    deps: ChatFlowDeps,
    params: PrepareSendMessageContextParams
): Promise<SendMessageBaseContext> => {
    const { userId, normalizedMessage, profile, requestedConversationId, authorization } = params;
    const [{ conversationId, conversation }, baseCareerProfile, serverUser, userAchievements, userRoleExperience] =
        await Promise.all([
            deps.conversationService.getConversation(userId, requestedConversationId),
            deps.profileService.updateProfileFromInput(userId, profile),
            deps.externalService.readUserPublicProfile(userId).catch(() => null),
            deps.externalService.readUserAchievements(userId),
            deps.externalService.readUserRoleExperience(userId),
        ]);
    const conversationAfterUserMessage = await deps.conversationService.saveUserMessage(
        userId,
        conversation,
        normalizedMessage
    );

    const userAccountContext = buildUserAccountContext({ serverUser, profile });
    const achievementInference = inferAchievementsFromMessage(normalizedMessage);
    const inferredSignalUpdate = toSignalUpdateFromInferences(
        normalizedMessage,
        achievementInference.skills,
        achievementInference.inferredSkills
    );
    const [userCareerProfile] = await Promise.all([
        deps.profileService.mergeProfileSignals(baseCareerProfile, inferredSignalUpdate),
        updateUserAchievements(deps, userId, achievementInference),
    ]);
    const confidenceSummary = calculateConfidence(userCareerProfile, userRoleExperience);

    const followUpIntent = detectFollowUpIntent(normalizedMessage);
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
        followUpIntent,
        authorization,
    };
};
