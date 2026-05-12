import { describe, expect, it, afterEach } from "vitest";
import { getChatInternalApiKey, isChatInternalKeyValid } from "./chat-internal-auth.utils";

describe("chat-internal-auth.utils", () => {
    const original = process.env.CHAT_INTERNAL_API_KEY;

    afterEach(() => {
        if (original === undefined) {
            delete process.env.CHAT_INTERNAL_API_KEY;
        } else {
            process.env.CHAT_INTERNAL_API_KEY = original;
        }
    });

    it("isChatInternalKeyValid returns false when env key is not set", () => {
        delete process.env.CHAT_INTERNAL_API_KEY;
        expect(getChatInternalApiKey()).toBeNull();
        expect(isChatInternalKeyValid("any")).toBe(false);
    });

    it("isChatInternalKeyValid returns true for exact match when configured", () => {
        process.env.CHAT_INTERNAL_API_KEY = "test-secret-key-32chars-min!!";
        expect(isChatInternalKeyValid("test-secret-key-32chars-min!!")).toBe(true);
        expect(isChatInternalKeyValid("wrong")).toBe(false);
    });
});
