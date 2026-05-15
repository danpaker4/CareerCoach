import type { FastifyReply, FastifyRequest } from "fastify";
import { StatusCodes } from "http-status-codes";
import type { ChatMessageRequestBody } from "./chat.types";
import { readOptionalConversationIdQuery, readOptionalUserProfileFromBody } from "./chat.utils";
import { ConversationNotFoundError, InvalidConversationIdError } from "./conversation/conversation.utils";
import { ChatService } from "./chat.service";

export class ChatController {
    constructor(private readonly chatService: ChatService) {}

    listConversations = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
        try {
            const { userId } = request.params as { userId: string };
            const conversations = await this.chatService.listConversationSummaries(userId);
            reply.status(StatusCodes.OK).send({ conversations });
        } catch (error) {
            request.log.error({ error }, "Failed listing conversations");
            reply.status(StatusCodes.INTERNAL_SERVER_ERROR).send({
                error: "Failed listing conversations",
                details: error instanceof Error ? error.message : String(error),
            });
        }
    };

    createConversation = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
        try {
            const { userId } = request.params as { userId: string };
            const conversation = await this.chatService.createConversation(userId);
            reply.status(StatusCodes.CREATED).send(conversation);
        } catch (error) {
            request.log.error({ error }, "Failed creating conversation");
            reply.status(StatusCodes.INTERNAL_SERVER_ERROR).send({
                error: "Failed creating conversation",
                details: error instanceof Error ? error.message : String(error),
            });
        }
    };

    deleteConversation = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
        try {
            const { userId, conversationId } = request.params as { userId: string; conversationId: string };
            await this.chatService.deleteConversation(userId, conversationId);
            reply.status(StatusCodes.NO_CONTENT).send();
            return;
        } catch (error) {
            if (error instanceof ConversationNotFoundError) {
                reply.status(StatusCodes.NOT_FOUND).send({ error: "Conversation not found" });
                return;
            }
            if (error instanceof InvalidConversationIdError) {
                reply.status(StatusCodes.BAD_REQUEST).send({ error: "Invalid conversation id" });
                return;
            }
            request.log.error({ error }, "Failed deleting conversation");
            reply.status(StatusCodes.INTERNAL_SERVER_ERROR).send({
                error: "Failed deleting conversation",
                details: error instanceof Error ? error.message : String(error),
            });
        }
    };

    getConversation = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
        try {
            const { userId } = request.params as { userId: string };
            const conversationId = readOptionalConversationIdQuery(request);
            const conversation = await this.chatService.getConversation(userId, conversationId);
            reply.status(StatusCodes.OK).send(conversation);
        } catch (error) {
            if (error instanceof ConversationNotFoundError) {
                reply.status(StatusCodes.NOT_FOUND).send({ error: "Conversation not found" });
                return;
            }
            if (error instanceof InvalidConversationIdError) {
                reply.status(StatusCodes.BAD_REQUEST).send({ error: "Invalid conversation id" });
                return;
            }
            request.log.error({ error }, "Failed loading conversation");
            reply.status(StatusCodes.INTERNAL_SERVER_ERROR).send({
                error: "Failed loading conversation",
                details: error instanceof Error ? error.message : String(error),
            });
        }
    };

    sendMessage = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
        try {
            const body = request.body as ChatMessageRequestBody;
            const response = await this.chatService.sendMessage(body.userId, body.message, body.userProfile, body.conversationId);
            reply.status(StatusCodes.OK).send(response);
        } catch (error) {
            if (error instanceof Error && error.message === "Message is required") {
                reply.status(StatusCodes.BAD_REQUEST).send({ error: error.message });
                return;
            }
            if (error instanceof ConversationNotFoundError) {
                reply.status(StatusCodes.NOT_FOUND).send({ error: "Conversation not found" });
                return;
            }
            if (error instanceof InvalidConversationIdError) {
                reply.status(StatusCodes.BAD_REQUEST).send({ error: "Invalid conversation id" });
                return;
            }

            request.log.error({ error }, "Failed sending chat message");
            reply.status(StatusCodes.INTERNAL_SERVER_ERROR).send({
                error: "Failed sending chat message",
                details: error instanceof Error ? error.message : String(error),
            });
        }
    };
}
