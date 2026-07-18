export type QueueConfig = {
    readonly rabbitMqUrl: string;
    readonly requestQueueName: string;
    readonly eventsExchangeName: string;
};
