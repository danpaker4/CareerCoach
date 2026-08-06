import type { ChatFlow } from "../../chat-flow.types";
import type { ChatConversationService } from "../../../routes/conversation/conversation.service";

export type ChatServiceDependencies = {
    readonly chatFlow: ChatFlow;
    readonly conversationService: ChatConversationService;
};
