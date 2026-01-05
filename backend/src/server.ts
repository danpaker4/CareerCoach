import Fastify from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import { usersRouter } from "./routes/users/users.router";

const fastify = Fastify({
  logger: true,
})
  .setValidatorCompiler(validatorCompiler)
  .setSerializerCompiler(serializerCompiler)
  .withTypeProvider<import("fastify-type-provider-zod").ZodTypeProvider>();
const start = async () => {
  try {
    await fastify.register(usersRouter());
    await fastify.listen({ port: 3000, host: "0.0.0.0" });
    console.log("Server is running on http://localhost:3000");
    console.log("Users routes registered");
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();

