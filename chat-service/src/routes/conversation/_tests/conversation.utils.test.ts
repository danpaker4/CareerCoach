import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mergeReturnedJobHistory } from "../conversation.utils";
import type { SanitizedJob } from "../job-in-conversation.types";

const job = (id: string, title: string): SanitizedJob => ({
    id,
    title,
    company: "Example",
    seniority: "Mid",
    description: "",
    requirements: [],
    mustKnowSkills: [],
    niceToHaveSkills: [],
    benefits: [],
    salary: null,
    location: null,
    url: "https://example.com",
});

describe("mergeReturnedJobHistory", () => {
    it("retains earlier jobs and refreshes duplicate snapshots without changing their order", () => {
        const result = mergeReturnedJobHistory(
            [job("earlier", "Earlier title"), job("duplicate", "Old title")],
            [job("duplicate", "Updated title"), job("new", "New title")],
        );

        assert.deepEqual(result.map(({ id }) => id), ["earlier", "duplicate", "new"]);
        assert.equal(result[1]?.title, "Updated title");
    });
});
