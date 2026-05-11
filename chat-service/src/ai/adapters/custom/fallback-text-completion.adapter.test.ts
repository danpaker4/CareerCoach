import { describe, expect, it, vi } from "vitest";
import { FallbackTextCompletionAdapter } from "./fallback-text-completion.adapter";

describe("FallbackTextCompletionAdapter", () => {
    it("returns first successful completion after fallback", async () => {
        const primary = { complete: vi.fn().mockRejectedValue(new Error("Ollama timeout")) };
        const secondary = { complete: vi.fn().mockResolvedValue("reply from backup") };
        const adapter = new FallbackTextCompletionAdapter([
            { provider: "ollama", adapter: primary },
            { provider: "gemini", adapter: secondary },
        ]);

        await expect(adapter.complete("hello")).resolves.toBe("reply from backup");
        expect(primary.complete).toHaveBeenCalledOnce();
        expect(secondary.complete).toHaveBeenCalledOnce();
    });

    it("throws aggregate error when all providers fail", async () => {
        const adapter = new FallbackTextCompletionAdapter([
            { provider: "ollama", adapter: { complete: vi.fn().mockRejectedValue(new Error("down")) } },
            { provider: "gemini", adapter: { complete: vi.fn().mockRejectedValue(new Error("invalid key")) } },
        ]);

        await expect(adapter.complete("hello")).rejects.toThrowError(
            "All LLM providers failed (ollama: down | gemini: invalid key)"
        );
    });
});
