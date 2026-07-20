import type { FastifyReply, FastifyRequest } from "fastify";
import { StatusCodes } from "http-status-codes";
import type { Collection } from "mongodb";
import { authenticateRequest } from "../auth/auth.middleware";
import type { UserDocument } from "../users/user.model";
import { toUser } from "../users/user.utils";

export const requireAdminRequest = (usersCollection: Collection<UserDocument>) =>
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
        await authenticateRequest(request, reply);
        if (reply.sent) {
            return;
        }

        const authUser = request.authUser;
        if (!authUser) {
            reply.status(StatusCodes.UNAUTHORIZED).send({ error: "Unauthorized", errorCode: "UNAUTHORIZED" });
            return;
        }

        const user = await usersCollection.findOne({ _id: authUser.userId });
        if (!user) {
            reply.status(StatusCodes.UNAUTHORIZED).send({ error: "User not found", errorCode: "ACCESS_TOKEN_INVALID" });
            return;
        }

        if (toUser(user).role !== "admin") {
            reply.status(StatusCodes.FORBIDDEN).send({ error: "Admin access required", errorCode: "ADMIN_REQUIRED" });
        }
    };
