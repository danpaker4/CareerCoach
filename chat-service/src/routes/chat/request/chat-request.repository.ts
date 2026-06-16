import type { Collection } from "mongodb";
import type { ProfileInput } from "../../conversation/conversation.types";
import type { ChatMessageResponse } from "../chat.types";
import type { ChatRequestDocument, ChatSocketTicketDocument } from "./chat-request.types";

const QUEUED_CHAT_REQUEST_STATUS = "queued";

export class ChatRequestRepository {
    constructor(
        private readonly requestsCollection: Collection<ChatRequestDocument>,
        private readonly socketTicketsCollection: Collection<ChatSocketTicketDocument>
    ) {}

    createQueuedRequest = async (params: {
        readonly requestId: string;
        readonly userId: string;
        readonly conversationId: string;
        readonly message: string;
        readonly userProfile?: ProfileInput;
    }): Promise<ChatRequestDocument> => {
        const now = new Date();
        const request: ChatRequestDocument = {
            requestId: params.requestId,
            userId: params.userId,
            conversationId: params.conversationId,
            message: params.message,
            ...(params.userProfile ? { userProfile: params.userProfile } : {}),
            status: QUEUED_CHAT_REQUEST_STATUS,
            createdAt: now,
            updatedAt: now,
            queuedAt: now,
        };
        await this.requestsCollection.insertOne(request);
        return request;
    };

    markStarted = async (requestId: string): Promise<ChatRequestDocument | null> => {
        const now = new Date();
        return await this.requestsCollection.findOneAndUpdate(
            { requestId },
            {
                $set: {
                    status: "started",
                    startedAt: now,
                    updatedAt: now,
                },
            },
            { returnDocument: "after" }
        );
    };

    markCompleted = async (requestId: string, response: ChatMessageResponse): Promise<ChatRequestDocument | null> => {
        const now = new Date();
        return await this.requestsCollection.findOneAndUpdate(
            { requestId },
            {
                $set: {
                    status: "completed",
                    response,
                    completedAt: now,
                    updatedAt: now,
                },
                $unset: { error: "" },
            },
            { returnDocument: "after" }
        );
    };

    markFailed = async (requestId: string, error: string): Promise<ChatRequestDocument | null> => {
        const now = new Date();
        return await this.requestsCollection.findOneAndUpdate(
            { requestId },
            {
                $set: {
                    status: "failed",
                    error,
                    failedAt: now,
                    updatedAt: now,
                },
            },
            { returnDocument: "after" }
        );
    };

    findByRequestId = async (requestId: string): Promise<ChatRequestDocument | null> =>
        await this.requestsCollection.findOne({ requestId });

    findByRequestIdAndUserId = async (requestId: string, userId: string): Promise<ChatRequestDocument | null> =>
        await this.requestsCollection.findOne({ requestId, userId });

    countQueuedByUserId = async (userId: string): Promise<number> =>
        await this.requestsCollection.countDocuments({ userId, status: QUEUED_CHAT_REQUEST_STATUS });

    countQueuedGlobal = async (): Promise<number> =>
        await this.requestsCollection.countDocuments({ status: QUEUED_CHAT_REQUEST_STATUS });

    createSocketTicket = async (ticketId: string, userId: string, expiresAt: Date): Promise<ChatSocketTicketDocument> => {
        const ticket: ChatSocketTicketDocument = {
            ticketId,
            userId,
            expiresAt,
            createdAt: new Date(),
        };
        await this.socketTicketsCollection.insertOne(ticket);
        return ticket;
    };

    consumeSocketTicket = async (ticketId: string): Promise<ChatSocketTicketDocument | null> =>
        await this.socketTicketsCollection.findOneAndUpdate(
            {
                ticketId,
                expiresAt: { $gt: new Date() },
                usedAt: { $exists: false },
            },
            { $set: { usedAt: new Date() } },
            { returnDocument: "after" }
        );
}

