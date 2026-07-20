import type { Conversation } from "../../routes/conversation/conversation.types";
import type { UserCareerProfile } from "../../routes/career-profile/career-profile.types";
import type { RoleExperienceEntry } from "../../routes/external-chat-tools/role-experience.types";
import type { JobSearchResultItem } from "../api/shared/chat.types";
import type { ConfidenceSummary } from "../stage-1-prepare-context/confidence/confidence.types";
import type { ConversationMode } from "../stage-1-prepare-context/mode-detection/conversation-mode.types";
import type { ChatFlowDeps, SendMessagePreparedContext } from "../chat-flow.types";

export type PresentRankedJobsOptions = {
    deps: ChatFlowDeps;
    userId: string;
    conversationId: string;
    normalizedMessage: string;
    conversation: Conversation;
    userCareerProfile: UserCareerProfile;
    userRoleExperience: RoleExperienceEntry[];
    jobs: JobSearchResultItem[];
    userAccountContext: string;
    userAchievements: SendMessagePreparedContext["userAchievements"];
    mode: ConversationMode;
    confidenceSummary: ConfidenceSummary;
    queryLabel: string;
    searchIntent: string;
    includeRecommendedDirections?: boolean;
    directionHint?: string;
};
