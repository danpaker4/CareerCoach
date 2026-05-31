import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_CHAT_RATE_LIMIT_RULES } from "./chat-rate-limit.consts";
import { parseChatRateLimitUpdateInput } from "./chat-rate-limit.utils";

describe("parseChatRateLimitUpdateInput", () => {
    it("accepts the predefined rate-limit rules", () => {
        const parsed = parseChatRateLimitUpdateInput({ rules: DEFAULT_CHAT_RATE_LIMIT_RULES });

        assert.equal(parsed.rules.perUserPerMinute.limit, 10);
        assert.equal(parsed.rules.maxMessageCharacters.enabled, true);
    });

    it("rejects unknown rule keys", () => {
        assert.throws(() => parseChatRateLimitUpdateInput({
            rules: {
                ...DEFAULT_CHAT_RATE_LIMIT_RULES,
                customWindow: { enabled: true, limit: 1 },
            },
        }));
    });

    it("rejects unsafe limits", () => {
        assert.throws(() => parseChatRateLimitUpdateInput({
            rules: {
                ...DEFAULT_CHAT_RATE_LIMIT_RULES,
                perUserPerMinute: { enabled: true, limit: 0 },
            },
        }));
    });
});

