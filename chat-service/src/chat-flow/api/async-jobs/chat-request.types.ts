import type { ProfileInput } from "../../../routes/conversation/conversation.types";
import type { ChatMessageResponse } from "../shared/chat.types";
import type { ChatRateLimitBlockedDecision } from "../../stage-0-gateway/rate-limit/chat-rate-limit.types";

export type ChatRequestStatus = "queued" | "started" | "completed" | "failed";

export type ChatRequestDocument = {
    readonly requestId: string;
    readonly userId: string;
    readonly conversationId: string;
    readonly message: string;
    readonly userProfile?: ProfileInput;
    readonly status: ChatRequestStatus;
    readonly createdAt: Date;
    readonly updatedAt: Date;
    readonly queuedAt: Date;
    readonly startedAt?: Date;
    readonly completedAt?: Date;
    readonly failedAt?: Date;
    readonly response?: ChatMessageResponse;
    readonly error?: string;
};

export type ChatSocketTicketDocument = {
    readonly ticketId: string;
    readonly userId: string;
    readonly createdAt: Date;
    readonly expiresAt: Date;
    readonly usedAt?: Date;
};

export type ChatQueuedSubmissionResponse = {
    readonly requestId: string;
    readonly conversationId: string;
    readonly status: "queued";
};

export type ChatRequestResponse = {
    readonly requestId: string;
    readonly userId: string;
    readonly conversationId: string;
    readonly status: ChatRequestStatus;
    readonly createdAt: string;
    readonly updatedAt: string;
    readonly queuedAt: string;
    readonly startedAt?: string;
    readonly completedAt?: string;
    readonly failedAt?: string;
    readonly response?: ChatMessageResponse;
    readonly error?: string;
};

export type ChatSocketTicketResponse = {
    readonly ticket: string;
    readonly expiresAt: string;
};

export type ChatRequestSubmissionResult =
    | { readonly status: "blocked"; readonly decision: ChatRateLimitBlockedDecision }
    | { readonly status: "queued"; readonly response: ChatQueuedSubmissionResponse };
