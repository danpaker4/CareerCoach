import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveLlmConfig } from "../litellm-config.utils";

describe("resolveLlmConfig", () => {
    it("always resolves LiteLLM from base URL, model, and optional API key", () => {
        const config = resolveLlmConfig({
            liteLlmBaseUrl: "http://127.0.0.1:4000",
            liteLlmModel: "chat-default",
            liteLlmApiKey: "proxy-key",
        });

        assert.deepEqual(config, {
            provider: "litellm",
            endpointUrl: "http://127.0.0.1:4000",
            model: "chat-default",
            apiKey: "proxy-key",
        });
    });

    it("defaults to chat-default when no model is set", () => {
        const config = resolveLlmConfig({
            liteLlmBaseUrl: "http://127.0.0.1:4000",
        });

        assert.equal(config.provider, "litellm");
        assert.equal(config.model, "chat-default");
        assert.equal(config.apiKey, undefined);
    });

    it("throws when LITELLM_BASE_URL is missing", () => {
        assert.throws(
            () => resolveLlmConfig({ liteLlmModel: "chat-default" }),
            /missing LITELLM_BASE_URL/
        );
    });
});
