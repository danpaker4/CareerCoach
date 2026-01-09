import { FastifyReply } from "fastify";
import { StatusCodes } from "http-status-codes";
import { SchematicRequest } from "../../types/fastify";
import { getAccessTokenGitSchema } from "./github.schema";

type UsersHandlerType = {
    getAccessTokenGit: (request: SchematicRequest<typeof getAccessTokenGitSchema>, reply: FastifyReply) => Promise<void>;
};

export const GithubHandler = (): UsersHandlerType => {
    return {
        getAccessTokenGit: async (request: SchematicRequest<typeof getAccessTokenGitSchema>, reply: FastifyReply) => {
                    // const { userId } = request.params;
        
                    try {
                        const roadMaps = 's'
        
                        if (!roadMaps || roadMaps.length === 0) {
                            reply.code(StatusCodes.NOT_FOUND).send({ error: "No career road maps found for this user" });
                            return;
                        }
        
                        reply.code(StatusCodes.OK).send('OK');
                    } catch (error) {
                        reply.code(StatusCodes.INTERNAL_SERVER_ERROR).send({ message: "Internal server error", status: "ERROR" });
                    }
                },
    }
};
