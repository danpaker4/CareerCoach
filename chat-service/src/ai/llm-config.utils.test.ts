import { describe, expect, it } from "vitest";
import { resolveLlmConfig } from "./llm-config.utils";

describe("resolveLlmConfig", () => {
    it("resolves gemini config", () => {
        const config = resolveLlmConfig({
            llmProvider: "gemini",
            geminiApiKey: "key",
            llmModel: "gemini-3.0-flash",
        });
        expect(config.provider).toBe("gemini");
    });

    it("resolves openai config", () => {
        const config = resolveLlmConfig({
            llmProvider: "openai",
            openaiApiKey: "key",
            openaiModel: "gpt-4o-mini",
        });
        expect(config.provider).toBe("openai");
    });

    it("resolves ollama config", () => {
        const config = resolveLlmConfig({
            llmProvider: "ollama",
            ollamaBaseUrl: "http://127.0.0.1:9009",
            ollamaModel: "llama3",
        });
        expect(config).toEqual({
            provider: "ollama",
            endpointUrl: "http://127.0.0.1:9009",
            model: "llama3",
        });
    });

    it("resolves custom config", () => {
        const config = resolveLlmConfig({
            llmProvider: "custom",
            customLlmUrl: "http://127.0.0.1:9999",
        });
        expect(config.provider).toBe("custom");
    });
});
