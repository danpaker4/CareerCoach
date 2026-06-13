import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseChatQueueJob, parseChatRequestEvent, serializeChatQueuePayload } from "../chat-queue.utils";
import type { ChatQueueJob, ChatRequestEvent } from "../chat-queue.types";

describe("chat queue payload utils", () => {
    it("round-trips chat queue jobs", () => {
        const job: ChatQueueJob = {
            requestId: "request-1",
            userId: "user-1",
            conversationId: "conversation-1",
            message: "hello",
            userProfile: {
                firstName: "Dana",
                technologies: ["TypeScript"],
            },
        };

        const parsed = parseChatQueueJob(serializeChatQueuePayload(job));

        assert.deepEqual(parsed, job);
    });

    it("round-trips completed chat request events", () => {
        const event: ChatRequestEvent = {
            type: "completed",
            requestId: "request-1",
            userId: "user-1",
            conversationId: "conversation-1",
            status: "completed",
            response: {
                reply: "done",
            },
        };

        const parsed = parseChatRequestEvent(serializeChatQueuePayload(event));

        assert.deepEqual(parsed, event);
    });

    it("rejects invalid queue payloads", () => {
        const parsed = parseChatQueueJob(Buffer.from(JSON.stringify({ requestId: "request-1" }), "utf8"));

        assert.equal(parsed, null);
    });
});

