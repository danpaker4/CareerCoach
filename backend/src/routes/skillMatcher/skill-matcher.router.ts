import type { Collection } from "mongodb";
import type { TypedFastify } from "../../types/fastify";
import type { SkillMatcher } from "./skill-matcher.model";
import { addSkillSchema, editSkillSchema, getSkillMatcherByUserIdSchema } from "./skill-matcher.schema";
import { SkillMatcherHandler } from "./skill-matcher.handler";

type registerRouter = (fastify: TypedFastify) => void;

export const skillMatcherRouter = (skillMatchersCollection: Collection<SkillMatcher>): registerRouter => (fastify: TypedFastify): void => {
    const handler = SkillMatcherHandler(skillMatchersCollection);

    fastify.get("/skill-matcher/:userId", { schema: getSkillMatcherByUserIdSchema }, handler.getSkillMatcherByUserIdHandler);
    fastify.post("/skill-matcher/:id/skill", { schema: addSkillSchema }, handler.addSkillHandler);
    fastify.patch("/skill-matcher/:userId/:jobId/:skill", { schema: editSkillSchema }, handler.editSkillHandler);
};
