import type { Conversation } from "../../../../routes/conversation/conversation.model";
import type { ChatFlowDeps, SendMessagePreparedContext } from "../../../chat-flow.types";

export type AddJobToPipelineResult =
    | { status: "created" }
    | { status: "already_in_pipeline" }
    | { status: "error"; message: string };

export type HandlePipelineAcceptParams = {
    deps: ChatFlowDeps;
    ctx: SendMessagePreparedContext;
    jobContext: NonNullable<Conversation["jobContext"]>;
};
