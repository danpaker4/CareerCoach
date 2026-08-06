import type { QueueConfigEnv } from "./queue-config.schema";
import type { QueueConfig } from "./queue-config.types";

export const createQueueConfig = (env: QueueConfigEnv): QueueConfig => ({
    rabbitMqUrl: env.RABBITMQ_URL,
    requestQueueName: env.CHAT_REQUEST_QUEUE_NAME,
    eventsExchangeName: env.CHAT_EVENTS_EXCHANGE_NAME,
});
