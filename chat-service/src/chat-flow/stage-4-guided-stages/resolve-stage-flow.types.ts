import type { ChatFlowDeps, SendMessagePreparedContext } from "../chat-flow.types";

export type ResolveStageFlowForSendMessageParams = {
    deps: ChatFlowDeps;
    ctx: SendMessagePreparedContext;
    shouldSkipStages: boolean;
};
