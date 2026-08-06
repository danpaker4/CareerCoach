import { z } from "zod";
import { envString } from "../env.utils";

export const queueConfigEnvSchema = z.object({
    RABBITMQ_URL: envString("RABBITMQ_URL"),
    CHAT_REQUEST_QUEUE_NAME: z.string().min(1).default("chat.message.requests"),
    CHAT_EVENTS_EXCHANGE_NAME: z.string().min(1).default("chat.request.events"),
});

export type QueueConfigEnv = z.infer<typeof queueConfigEnvSchema>;
