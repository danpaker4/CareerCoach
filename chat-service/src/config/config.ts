import { z } from "zod";
import type { ServerConfig } from "./config.types";
import { chatConfigEnvSchema } from "./chat/chat-config.schema";
import { createChatConfig } from "./chat/chat-config.utils";
import { litellmConfigEnvSchema } from "./litellm/litellm-config.schema";
import { createLitellmConfig } from "./litellm/litellm-config.utils";
import { mongoConfigEnvSchema } from "./mongo/mongo-config.schema";
import { createMongoConfig } from "./mongo/mongo-config.utils";
import { queueConfigEnvSchema } from "./queue/queue-config.schema";
import { createQueueConfig } from "./queue/queue-config.utils";
import { serverConfigEnvSchema } from "./server/server-config.schema";
import { createServerHostConfig } from "./server/server-config.utils";

const EnvSchema = z.object({
    ...serverConfigEnvSchema.shape,
    ...mongoConfigEnvSchema.shape,
    ...chatConfigEnvSchema.shape,
    ...queueConfigEnvSchema.shape,
    ...litellmConfigEnvSchema.shape,
});

export const createConfigFromEnv = (env: NodeJS.ProcessEnv): ServerConfig => {
    const parsed = EnvSchema.parse(env);
    const serverHost = createServerHostConfig(parsed);
    const llm = createLitellmConfig(parsed);

    return {
        ...serverHost,
        mongoConfig: createMongoConfig(parsed),
        chatConfig: createChatConfig(parsed, llm),
        queueConfig: createQueueConfig(parsed),
    };
};
