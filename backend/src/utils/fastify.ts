import Fastify from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import type { TypedFastify } from "../types/fastify";

export const createFastifyInstance = (): TypedFastify => {
  return Fastify({
    logger: true,
  })
    .setValidatorCompiler(validatorCompiler)
    .setSerializerCompiler(serializerCompiler)
    .withTypeProvider<import("fastify-type-provider-zod").ZodTypeProvider>();
};

