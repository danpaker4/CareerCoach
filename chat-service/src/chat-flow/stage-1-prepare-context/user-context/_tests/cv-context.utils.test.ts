import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isCvStorageReference, isReadableCvText, pickCvExcerpt } from "../cv-context.utils";

describe("isCvStorageReference", () => {
    it("detects S3 and upload paths", () => {
        assert.equal(isCvStorageReference("s3://bucket/uploads/cv/user.pdf"), true);
        assert.equal(isCvStorageReference("uploads/cv/user-id.pdf"), true);
        assert.equal(isCvStorageReference("Senior engineer with React and Node.js experience...".repeat(2)), false);
    });
});

describe("isReadableCvText", () => {
    it("requires substantive non-URI text", () => {
        assert.equal(isReadableCvText("s3://bucket/uploads/cv/user.pdf"), false);
        assert.equal(isReadableCvText("short"), false);
        assert.equal(
            isReadableCvText(
                "Gal Kosover\nSoftware Engineer\nBuilt APIs with Node.js and TypeScript for 4 years across product teams."
            ),
            true
        );
    });
});

describe("pickCvExcerpt", () => {
    it("prefers cvText over S3 cv URI", () => {
        const excerpt = pickCvExcerpt({
            cv: "s3://bucket/uploads/cv/user.pdf",
            cvText: "Gal Kosover\nSoftware Engineer\nBuilt APIs with Node.js and TypeScript for 4 years across product teams.",
        });
        assert.match(excerpt ?? "", /Software Engineer/);
        assert.doesNotMatch(excerpt ?? "", /s3:\/\//);
    });

    it("ignores S3 URIs from profile and server", () => {
        const excerpt = pickCvExcerpt(
            { cv: "s3://bucket/uploads/cv/user.pdf" },
            { cvExcerpt: "s3://bucket/uploads/cv/user.pdf" }
        );
        assert.equal(excerpt, null);
    });
});
