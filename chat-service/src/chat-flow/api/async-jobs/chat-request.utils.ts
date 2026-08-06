import type {
    ChatRequestDocument,
    ChatRequestResponse,
    ChatSocketTicketDocument,
    ChatSocketTicketResponse,
} from "./chat-request.types";

export const toChatRequestResponse = (request: ChatRequestDocument): ChatRequestResponse => ({
    requestId: request.requestId,
    userId: request.userId,
    conversationId: request.conversationId,
    status: request.status,
    createdAt: request.createdAt.toISOString(),
    updatedAt: request.updatedAt.toISOString(),
    queuedAt: request.queuedAt.toISOString(),
    ...(request.startedAt ? { startedAt: request.startedAt.toISOString() } : {}),
    ...(request.completedAt ? { completedAt: request.completedAt.toISOString() } : {}),
    ...(request.failedAt ? { failedAt: request.failedAt.toISOString() } : {}),
    ...(request.response ? { response: request.response } : {}),
    ...(request.error ? { error: request.error } : {}),
});

export const toChatSocketTicketResponse = (ticket: ChatSocketTicketDocument): ChatSocketTicketResponse => ({
    ticket: ticket.ticketId,
    expiresAt: ticket.expiresAt.toISOString(),
});

export const readErrorMessage = (error: unknown): string =>
    error instanceof Error ? error.message : String(error);

