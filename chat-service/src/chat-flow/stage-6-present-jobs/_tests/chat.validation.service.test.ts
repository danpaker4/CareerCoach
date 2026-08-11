import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MAX_REPLY_LINES } from "../presentation/chat.validation.consts";
import { sanitizeReply } from "../presentation/chat.validation.service";

describe("sanitizeReply", () => {
    it("removes a bare identifier the model copied from the job payload", () => {
        const reply = sanitizeReply("This role (5759fb60-23b0-48f8-83be-bda7c59ec413) suits you.");
        assert.doesNotMatch(reply, /5759fb60/);
        assert.match(reply, /This role/);
    });

    it("still removes a labelled job id", () => {
        assert.doesNotMatch(sanitizeReply("Consider jobId: abc-123 for this."), /abc-123/);
    });

    it("caps a runaway reply at the line limit", () => {
        const long = Array.from({ length: 40 }, (_, index) => `line ${index + 1}`).join("\n");
        const nonEmpty = sanitizeReply(long).split("\n").filter((line) => line.trim().length > 0);
        assert.equal(nonEmpty.length, MAX_REPLY_LINES);
    });

    it("leaves an ordinary reply untouched", () => {
        const reply = "Here are two roles that fit.\n\nWhich should I add to your pipeline?";
        assert.equal(sanitizeReply(reply), reply);
    });
});
