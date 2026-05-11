import type { Collection } from "mongodb";
import { TypedFastify } from "../../types/fastify";
import { LinkedInHandler } from "./linkedin.handler";
import type { UserDocument } from "../users/user.model";
import { linkedInCallbackSchema } from "./linkedin.schema";

type registerRouter = (fastify: TypedFastify) => void;

export const linkedInRouter = (usersCollection: Collection<UserDocument>): registerRouter => (fastify: TypedFastify): void => {
    const handler = LinkedInHandler(usersCollection);
    fastify.get("/linkedin/callback", { schema: linkedInCallbackSchema }, handler.linkedInCallback);
};
