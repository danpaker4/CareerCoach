import type { ProfileInput } from "../../conversation/conversation.types";
import type { ChatMessageResponse } from "../chat.types";
import type { ChatRequestStatus } from "../request/chat-request.types";

export type ChatQueueConfig = {
    readonly rabbitMqUrl: string;
    readonly requestQueueName: string;
    readonly eventsExchangeName: string;
};

export type ChatQueueJob = {
    readonly requestId: string;
    readonly userId: string;
    readonly conversationId: string;
    readonly message: string;
    readonly userProfile?: ProfileInput;
};

export type ChatRequestEvent =
    | {
        readonly type: "queued";
        readonly requestId: string;
        readonly userId: string;
        readonly conversationId: string;
        readonly status: Extract<ChatRequestStatus, "queued">;
      }
    | {
        readonly type: "started";
        readonly requestId: string;
        readonly userId: string;
        readonly conversationId: string;
        readonly status: Extract<ChatRequestStatus, "started">;
      }
    | {
        readonly type: "completed";
        readonly requestId: string;
        readonly userId: string;
        readonly conversationId: string;
        readonly status: Extract<ChatRequestStatus, "completed">;
        readonly response: ChatMessageResponse;
      }
    | {
        readonly type: "failed";
        readonly requestId: string;
        readonly userId: string;
        readonly conversationId: string;
        readonly status: Extract<ChatRequestStatus, "failed">;
        readonly error: string;
      };

