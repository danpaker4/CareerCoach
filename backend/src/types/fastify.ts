export type registerRouter = (fastify: TypedFastify) => void;

import { FastifyBaseLogger, FastifyInstance, FastifySchema, RawReplyDefaultExpression, RawRequestDefaultExpression, RawServerDefault, RouteGenericInterface } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import type { ResolveFastifyRequestType } from "fastify/types/type-provider.js";

export type TypedFastify = FastifyInstance<RawServerDefault, RawRequestDefaultExpression,
    RawReplyDefaultExpression, FastifyBaseLogger, ZodTypeProvider>;

export type SchematicRequest<Schema extends FastifySchema> =
    ResolveFastifyRequestType<ZodTypeProvider, Schema, RouteGenericInterface>;
