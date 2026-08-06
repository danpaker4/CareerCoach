import type { ChatFlowDeps, SendMessagePreparedContext } from "../chat-flow.types";
import type { StageDecision } from "../api/shared/chat.types";

export type ResolveStageFlowForSendMessageParams = {
    deps: ChatFlowDeps;
    ctx: SendMessagePreparedContext;
    shouldSkipStages: boolean;
    stageDecision: StageDecision;
};
