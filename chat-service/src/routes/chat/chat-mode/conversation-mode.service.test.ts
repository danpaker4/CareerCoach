import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ConversationModeService } from "./conversation-mode.service";

describe("ConversationModeService.detectMode", () => {
    const service = new ConversationModeService();

    it("returns DREAMJOB when a dream job flow is already active", () => {
        const mode = service.detectMode({
            hasActiveDreamJobFlow: true,
        });
        assert.equal(mode, "DREAMJOB");
    });

    it("returns the neutral fallback mode when no dream job flow is active", () => {
        const mode = service.detectMode({
            hasActiveDreamJobFlow: false,
        });
        assert.equal(mode, "GUIDED");
    });
});
