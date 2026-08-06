import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { withJobSelectionClosing } from "../presentation/chat.job-presentation.utils";

describe("job selection closing", () => {
    it("keeps the single-role yes/no pipeline question when one match is shown", () => {
        const reply = withJobSelectionClosing("This role fits your backend work.", [{ company: "TestCorp" }]);
        assert.match(reply, /add it to your pipeline\?$/);
    });

    it("asks the user to name a card when several matches are shown", () => {
        const reply = withJobSelectionClosing("Here is what I found.", [
            { company: "TestCorp" },
            { company: "Globex" },
        ]);
        assert.match(reply, /I listed 2 matches above/);
        assert.match(reply, /add the first one/);
        assert.match(reply, /add the TestCorp role/);
        assert.match(reply, /broaden the search or save the role to your wishlist/);
    });

    it("omits the company example when the first card has no company name", () => {
        const reply = withJobSelectionClosing("Here is what I found.", [{ company: "  " }, { company: "Globex" }]);
        assert.match(reply, /say "add the first one"\./);
        assert.doesNotMatch(reply, /add the\s+role/);
    });

    it("preserves the model's wording ahead of the closing", () => {
        const reply = withJobSelectionClosing("Strong match on your Python testing background.", [
            { company: "A" },
            { company: "B" },
        ]);
        assert.ok(reply.startsWith("Strong match on your Python testing background."));
    });
});
