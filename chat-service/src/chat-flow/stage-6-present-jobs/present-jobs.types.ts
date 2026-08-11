import type { Conversation } from "../../routes/conversation/conversation.model";
import type { JobSearchResultItem } from "../api/shared/chat.types";
import type { ChatFlowDeps, SendMessagePreparedContext } from "../chat-flow.types";

export type PresentRankedJobsOptions = {
    deps: ChatFlowDeps;
    ctx: SendMessagePreparedContext;
    jobs: JobSearchResultItem[];
    searchIntent: string;
    /** Defaults to `ctx.conversationAfterUserMessage` when omitted. */
    conversation?: Conversation;
    /** Defaults to `ctx.normalizedMessage` when omitted. */
    queryLabel?: string;
    /** The role the search was for, used to rank by relevance. Defaults to the detected search query. */
    targetRole?: string;
    includeRecommendedDirections?: boolean;
    directionHint?: string;
};
