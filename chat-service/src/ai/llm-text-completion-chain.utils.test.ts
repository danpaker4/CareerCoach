import { describe, expect, it } from "vitest";
import { buildTextCompletionLlmChain } from "./llm-text-completion-chain.utils";

describe("buildTextCompletionLlmChain", () => {
    it("builds chain in fallback order with configured providers", () => {
        const chain = buildTextCompletionLlmChain({
            llmProvider: "ollama",
            ollamaBaseUrl: "http://127.0.0.1:11434",
            ollamaModel: "llama3",
            geminiApiKey: "gemini-key",
            openaiApiKey: "openai-key",
            customLlmUrl: "http://127.0.0.1:4000",
            llmModel: "gemini-3.0-flash",
            openaiModel: "gpt-4o-mini",
        });

        expect(chain.map((provider) => provider.provider)).toEqual(["ollama", "gemini", "openai", "custom"]);
    });

    it("includes ollama when explicitly selected as primary", () => {
        const chain = buildTextCompletionLlmChain({
            llmProvider: "ollama",
        });

        expect(chain).toHaveLength(1);
        expect(chain[0].provider).toBe("ollama");
    });

    it("includes ollama when base url is configured even if primary differs", () => {
        const chain = buildTextCompletionLlmChain({
            llmProvider: "gemini",
            ollamaBaseUrl: "http://127.0.0.1:11434",
            openaiApiKey: "openai-key",
        });

        expect(chain.map((provider) => provider.provider)).toEqual(["ollama", "openai"]);
    });

    it("returns empty chain when no provider is usable", () => {
        const chain = buildTextCompletionLlmChain({
            llmProvider: "gemini",
        });

        expect(chain).toEqual([]);
    });
});
