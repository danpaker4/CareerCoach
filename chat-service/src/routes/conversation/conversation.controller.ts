import type { FastifyReply, FastifyRequest } from "fastify";
import { StatusCodes } from "http-status-codes";
import { readOptionalConversationIdQuery } from "../../chat-flow/api/shared/chat.utils";
import { ConversationNotFoundError, InvalidConversationIdError } from "./conversation.utils";
import type { ChatConversationService } from "./conversation.service";

export class ConversationController {
    constructor(private readonly conversationService: ChatConversationService) {}

    listConversations = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
        try {
            const { userId } = request.params as { userId: string };
            const conversations = await this.conversationService.listConversationSummaries(userId);
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
            const conversation = await this.conversationService.createAdditionalConversation(userId);
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
            await this.conversationService.deleteConversation(userId, conversationId);
            reply.status(StatusCodes.NO_CONTENT).send();
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
            const conversation = await this.conversationService.getConversationResponse(userId, conversationId);
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
}
