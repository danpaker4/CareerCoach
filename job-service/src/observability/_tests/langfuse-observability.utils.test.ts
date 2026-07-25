import { afterEach, describe, expect, it } from "vitest";
import { createLangfuseContentAttributes } from "../langfuse-observability.utils";

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

describe("createLangfuseContentAttributes", () => {
    it("omits content when capture is disabled", () => {
        process.env.LANGFUSE_CAPTURE_CONTENT = "false";

        const attributes = createLangfuseContentAttributes("job prompt", "model response");

        expect(attributes).toEqual({
            "langfuse.observation.metadata.input_chars": "10",
            "langfuse.observation.metadata.output_chars": "14",
        });
    });

    it("captures redacted and truncated content when enabled", () => {
        process.env.LANGFUSE_CAPTURE_CONTENT = "true";
        process.env.LANGFUSE_CONTENT_MAX_CHARS = "20";

        const attributes = createLangfuseContentAttributes(
            "Contact jane@example.com",
            "generated model response"
        );

        expect(String(attributes["langfuse.observation.input"])).not.toContain("jane@example.com");
        expect(JSON.parse(String(attributes["langfuse.observation.output"])).text).toBe("generated model resp");
        expect(attributes["langfuse.observation.metadata.content_truncated"]).toBe("true");
    });
});
