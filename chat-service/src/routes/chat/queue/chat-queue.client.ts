import { connect, type Channel, type ChannelModel, type ConsumeMessage } from "amqplib";
import type { ChatQueueConfig, ChatQueueJob, ChatRequestEvent } from "./chat-queue.types";
import { parseChatQueueJob, parseChatRequestEvent, serializeChatQueuePayload } from "./chat-queue.utils";

type ChatQueueMessageHandler<T> = (payload: T) => Promise<void>;

export class ChatQueueClient {
    private connection: ChannelModel | null = null;
    private channel: Channel | null = null;

    constructor(private readonly config: ChatQueueConfig) {}

    start = async (): Promise<void> => {
        if (this.channel) {
            return;
        }

        const connection = await connect(this.config.rabbitMqUrl);
        const channel = await connection.createChannel();
        await channel.assertQueue(this.config.requestQueueName, { durable: true });
        await channel.assertExchange(this.config.eventsExchangeName, "fanout", { durable: true });
        this.connection = connection;
        this.channel = channel;
    };

    stop = async (): Promise<void> => {
        const channel = this.channel;
        const connection = this.connection;
        this.channel = null;
        this.connection = null;
        await channel?.close();
        await connection?.close();
    };

    publishJob = async (job: ChatQueueJob): Promise<void> => {
        const channel = this.getChannel();
        channel.sendToQueue(this.config.requestQueueName, serializeChatQueuePayload(job), {
            persistent: true,
            contentType: "application/json",
        });
    };

    publishEvent = async (event: ChatRequestEvent): Promise<void> => {
        const channel = this.getChannel();
        channel.publish(this.config.eventsExchangeName, "", serializeChatQueuePayload(event), {
            persistent: false,
            contentType: "application/json",
        });
    };

    consumeJobs = async (handler: ChatQueueMessageHandler<ChatQueueJob>, prefetch: number): Promise<void> => {
        const channel = this.getChannel();
        await channel.prefetch(prefetch);
        await channel.consume(this.config.requestQueueName, (message) => {
            void this.handleConsumedMessage(message, parseChatQueueJob, handler);
        });
    };

    consumeEvents = async (handler: ChatQueueMessageHandler<ChatRequestEvent>): Promise<void> => {
        const channel = this.getChannel();
        const queue = await channel.assertQueue("", { exclusive: true, durable: false, autoDelete: true });
        await channel.bindQueue(queue.queue, this.config.eventsExchangeName, "");
        await channel.consume(queue.queue, (message) => {
            void this.handleConsumedMessage(message, parseChatRequestEvent, handler);
        }, { noAck: false });
    };

    updatePrefetch = async (prefetch: number): Promise<void> => {
        await this.getChannel().prefetch(prefetch);
    };

    private handleConsumedMessage = async <T>(
        message: ConsumeMessage | null,
        parsePayload: (content: Buffer) => T | null,
        handler: ChatQueueMessageHandler<T>
    ): Promise<void> => {
        if (!message) {
            return;
        }

        const channel = this.getChannel();
        try {
            const payload = parsePayload(message.content);
            if (!payload) {
                channel.ack(message);
                return;
            }

            await handler(payload);
            channel.ack(message);
        } catch (error) {
            channel.nack(message, false, false);
            console.error("Failed handling chat queue message", error);
        }
    };

    private getChannel = (): Channel => {
        if (!this.channel) {
            throw new Error("Chat queue is not connected");
        }

        return this.channel;
    };
}
