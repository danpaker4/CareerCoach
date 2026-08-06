import type { ChatConfig } from "./chat/chat-config.types";
import type { MongoConfig } from "./mongo/mongo-config.types";
import type { QueueConfig } from "./queue/queue-config.types";
import type { ServerHostConfig } from "./server/server-config.types";

export type ServerConfig = ServerHostConfig & {
    readonly mongoConfig: MongoConfig;
    readonly chatConfig: ChatConfig;
    readonly queueConfig: QueueConfig;
};
