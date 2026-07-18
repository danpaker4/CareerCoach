import type { SendMessage } from "../../chat-flow.types";
import { withSpan } from "../../../observability/tracing";
import { ChatRequestRepository } from "../../api/async-jobs/chat-request.repository";
import { readErrorMessage } from "../../api/async-jobs/chat-request.utils";
import { ChatRateLimitService } from "../rate-limit/chat-rate-limit.service";
import { ChatQueueClient } from "./chat-queue.client";
import type { ChatQueueJob, ChatRequestEvent } from "./chat-queue.types";

const ACTIVE_REQUEST_RETRY_DELAY_MS = 1_000;
const ACTIVE_REQUEST_MAX_ATTEMPTS = 60;
const WORKER_PREFETCH_REFRESH_MS = 10_000;

const delay = async (ms: number): Promise<void> =>
    await new Promise((resolve) => {
        setTimeout(resolve, ms);
    });

export class ChatQueueWorker {
    private prefetchRefreshInterval: NodeJS.Timeout | null = null;

    constructor(
        private readonly queueClient: ChatQueueClient,
        private readonly requestRepository: ChatRequestRepository,
        private readonly rateLimitService: ChatRateLimitService,
        private readonly sendMessage: SendMessage
    ) {}

    start = async (): Promise<void> => {
        await this.queueClient.start();
        const concurrency = await this.rateLimitService.getWorkerConcurrency();
        await this.queueClient.consumeJobs(this.handleJob, concurrency);
        this.prefetchRefreshInterval = setInterval(() => {
            void this.refreshPrefetch();
        }, WORKER_PREFETCH_REFRESH_MS);
    };

    stop = async (): Promise<void> => {
        const interval = this.prefetchRefreshInterval;
        this.prefetchRefreshInterval = null;
        if (interval) {
            clearInterval(interval);
        }
        await this.queueClient.stop();
    };

    private refreshPrefetch = async (): Promise<void> => {
        const concurrency = await this.rateLimitService.getWorkerConcurrency();
        await this.queueClient.updatePrefetch(concurrency).catch((error: unknown) => {
            console.error("Failed refreshing chat worker concurrency", error);
        });
    };

    private acquireActiveRequestWithRetry = async (
        userId: string,
        attemptsLeft = ACTIVE_REQUEST_MAX_ATTEMPTS
    ): Promise<{ readonly release: () => Promise<void> } | null> => {
        const decision = await this.rateLimitService.acquireWorkerRequest(userId);
        if (decision.status === "allowed") {
            return { release: decision.release };
        }

        if (attemptsLeft <= 0) {
            return null;
        }

        await delay(ACTIVE_REQUEST_RETRY_DELAY_MS);
        return await this.acquireActiveRequestWithRetry(userId, attemptsLeft - 1);
    };

    private publishEvent = async (event: ChatRequestEvent): Promise<void> => {
        await this.queueClient.publishEvent(event).catch((error: unknown) => {
            console.error("Failed publishing chat request event", error);
        });
    };

    private handleJob = async (job: ChatQueueJob): Promise<void> =>
        await withSpan("chat.worker.handle_job", {
            "chat.request.id": job.requestId,
            "conversation.id": job.conversationId,
            "enduser.id": job.userId,
            "messaging.destination.name": "chat.message.requests",
        }, async () => {
            await this.processJob(job);
        });

    private processJob = async (job: ChatQueueJob): Promise<void> => {
        const existingRequest = await this.requestRepository.findByRequestId(job.requestId);
        if (!existingRequest || existingRequest.status === "completed") {
            return;
        }

        const activeRequest = await this.acquireActiveRequestWithRetry(job.userId);
        if (!activeRequest) {
            const failedRequest = await this.requestRepository.markFailed(
                job.requestId,
                "A chat response is already being generated for this user."
            );
            await this.publishEvent({
                type: "failed",
                requestId: job.requestId,
                userId: job.userId,
                conversationId: job.conversationId,
                status: "failed",
                error: failedRequest?.error ?? "A chat response is already being generated for this user.",
            });
            return;
        }

        try {
            await this.requestRepository.markStarted(job.requestId);
            await this.publishEvent({
                type: "started",
                requestId: job.requestId,
                userId: job.userId,
                conversationId: job.conversationId,
                status: "started",
            });
            const response = await this.sendMessage(job.userId, job.message, job.userProfile, job.conversationId);
            await this.requestRepository.markCompleted(job.requestId, response);
            await this.publishEvent({
                type: "completed",
                requestId: job.requestId,
                userId: job.userId,
                conversationId: job.conversationId,
                status: "completed",
                response,
            });
        } catch (error) {
            const errorMessage = readErrorMessage(error);
            await this.requestRepository.markFailed(job.requestId, errorMessage);
            await this.publishEvent({
                type: "failed",
                requestId: job.requestId,
                userId: job.userId,
                conversationId: job.conversationId,
                status: "failed",
                error: errorMessage,
            });
        } finally {
            await activeRequest.release().catch((error: unknown) => {
                console.error("Failed releasing worker chat active request", error);
            });
        }
    };
}

