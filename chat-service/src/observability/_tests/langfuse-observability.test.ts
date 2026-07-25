import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
    createLangfuseContentAttributes,
    createLangfuseObservationAttributes,
    createLangfuseUsageAttributes,
} from "../tracing";

const originalCaptureContent = process.env.LANGFUSE_CAPTURE_CONTENT;
const originalContentMaxChars = process.env.LANGFUSE_CONTENT_MAX_CHARS;

const restoreEnvironment = (): void => {
    if (originalCaptureContent === undefined) {
        delete process.env.LANGFUSE_CAPTURE_CONTENT;
    } else {
        process.env.LANGFUSE_CAPTURE_CONTENT = originalCaptureContent;
    }

    if (originalContentMaxChars === undefined) {
        delete process.env.LANGFUSE_CONTENT_MAX_CHARS;
    } else {
        process.env.LANGFUSE_CONTENT_MAX_CHARS = originalContentMaxChars;
    }
};

afterEach(restoreEnvironment);

describe("Langfuse observability attributes", () => {
    it("does not export content while content capture is disabled", () => {
        process.env.LANGFUSE_CAPTURE_CONTENT = "false";

        const attributes = createLangfuseContentAttributes("candidate@example.com", "assistant response");

        assert.deepEqual(attributes, {
            "langfuse.observation.metadata.input_chars": "21",
            "langfuse.observation.metadata.output_chars": "18",
        });
        assert.equal("langfuse.observation.input" in attributes, false);
        assert.equal("langfuse.observation.output" in attributes, false);
    });

    it("masks secrets and truncates opt-in captured content", () => {
        process.env.LANGFUSE_CAPTURE_CONTENT = "true";
        process.env.LANGFUSE_CONTENT_MAX_CHARS = "8000";

        const attributes = createLangfuseContentAttributes(
            "Contact jane@example.com with Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.signature and password=topsecret",
            "1234567890"
        );
        const input = String(attributes["langfuse.observation.input"]);

        assert.doesNotMatch(input, /jane@example\.com|eyJhbGci|topsecret/);
        assert.match(input, /REDACTED_EMAIL|REDACTED_TOKEN|REDACTED/);
        assert.equal(attributes["langfuse.observation.metadata.content_redacted"], "true");

        process.env.LANGFUSE_CONTENT_MAX_CHARS = "5";
        const truncated = createLangfuseContentAttributes("abcdefgh", "12345678");
        assert.equal(JSON.parse(String(truncated["langfuse.observation.input"])).text, "abcde");
        assert.equal(truncated["langfuse.observation.metadata.content_truncated"], "true");
    });

    it("maps trace identity, model, and usage without embedding vectors", () => {
        const observation = createLangfuseObservationAttributes({
            operation: "chat.turn",
            type: "generation",
            userId: "application-user-uuid",
            sessionId: "conversation-uuid",
            feature: "chat",
            provider: "litellm",
            model: "chat-default",
        });
        const usage = createLangfuseUsageAttributes({
            promptTokens: 3,
            completionTokens: 5,
            totalTokens: 8,
        });

        assert.equal(observation["langfuse.export"], true);
        assert.equal(observation["langfuse.observation.type"], "generation");
        assert.equal(observation["langfuse.user.id"], "application-user-uuid");
        assert.equal(observation["langfuse.session.id"], "conversation-uuid");
        assert.equal(observation["langfuse.observation.model.name"], "chat-default");
        assert.deepEqual(JSON.parse(String(usage["langfuse.observation.usage_details"])), {
            input: 3,
            output: 5,
            total: 8,
        });
        assert.equal(JSON.stringify({ ...observation, ...usage }).includes("embedding_vector"), false);
    });
});
