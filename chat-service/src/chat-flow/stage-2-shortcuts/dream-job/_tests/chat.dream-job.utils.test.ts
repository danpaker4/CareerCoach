import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
    inferDreamJobTitleFromMessage,
    isAffirmativeConfirmation,
    isNegativeConfirmation,
    normalizeDreamJobTitle,
} from "../chat.dream-job.utils";

describe("chat.dream-job.utils", () => {
    it("detects affirmative confirmations", () => {
        assert.equal(isAffirmativeConfirmation("yes"), true);
        assert.equal(isAffirmativeConfirmation("Yeah that's right"), true);
        assert.equal(isAffirmativeConfirmation("maybe"), false);
    });

    it("detects negative confirmations", () => {
        assert.equal(isNegativeConfirmation("no"), true);
        assert.equal(isNegativeConfirmation("wrong title"), true);
        assert.equal(isNegativeConfirmation("yes"), false);
    });

    it("infers Founder from startup founder messages", () => {
        assert.equal(
            inferDreamJobTitleFromMessage(
                "i want to be a founder of startup that will find a solution to object detection with drones",
            ),
            "Founder",
        );
    });

    it("normalizes dream job titles", () => {
        assert.equal(normalizeDreamJobTitle("  founder  "), "Founder");
        assert.equal(normalizeDreamJobTitle("product manager"), "Product Manager");
    });
});
