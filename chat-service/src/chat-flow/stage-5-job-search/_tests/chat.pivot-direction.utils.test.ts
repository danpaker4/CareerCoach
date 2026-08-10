import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractPivotDirection } from "../direction-filters/chat.pivot-direction.utils";

describe("pivot direction extraction", () => {
    it("reads the role named alongside a rejection", () => {
        assert.equal(extractPivotDirection("nothing from here, maybe QA"), "QA");
        assert.equal(extractPivotDirection("none of these, what about devops"), "devops");
        assert.equal(extractPivotDirection("not for me — how about data engineering"), "data engineering");
    });

    it("handles a pivot phrased as a preference", () => {
        assert.equal(extractPivotDirection("I'd prefer frontend"), "frontend");
        assert.equal(extractPivotDirection("show me security roles"), "security");
    });

    it("strips trailing noise so the query stays a role", () => {
        assert.equal(extractPivotDirection("maybe QA jobs please"), "QA");
        assert.equal(extractPivotDirection("what about product roles"), "product");
    });

    it("returns null for a plain rejection so the normal flow still runs", () => {
        assert.equal(extractPivotDirection("none of these"), null);
        assert.equal(extractPivotDirection("nothing from here"), null);
        assert.equal(extractPivotDirection("not interested"), null);
        assert.equal(extractPivotDirection(""), null);
    });

    it("ignores a marker with nothing usable after it", () => {
        assert.equal(extractPivotDirection("maybe"), null);
        assert.equal(extractPivotDirection("maybe jobs"), null);
    });
});
