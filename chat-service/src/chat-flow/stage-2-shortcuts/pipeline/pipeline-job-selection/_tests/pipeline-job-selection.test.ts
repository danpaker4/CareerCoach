import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SanitizedJob } from "../../../../../routes/conversation/job-in-conversation.types";
import {
    parsePipelineJobSelectionFromJson,
    resolveSelectionFromParsedPick,
} from "../pipeline-job-selection.llm.utils";
import { resolvePipelineJobSelection } from "../pipeline-job-selection.service";

const job = (id: string, title: string, company: string): SanitizedJob => ({
    id,
    title,
    company,
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

describe("parsePipelineJobSelectionFromJson", () => {
    const candidates = [
        job("cellebrite-1", "QA Engineer", "Cellebrite"),
        job("checkpoint-1", "QA Engineer", "Check Point"),
    ];

    it("accepts a jobId that exists in the candidate set", () => {
        const parsed = parsePipelineJobSelectionFromJson(
            '{"jobId":"checkpoint-1","confidence":"high"}',
            candidates,
        );
        assert.equal(parsed.jobId, "checkpoint-1");
        assert.equal(parsed.confidence, "high");
    });

    it("rejects unknown jobIds and treats them as null", () => {
        const parsed = parsePipelineJobSelectionFromJson(
            '{"jobId":"not-in-list","confidence":"high"}',
            candidates,
        );
        assert.equal(parsed.jobId, null);
    });

    it("returns null on invalid JSON", () => {
        const parsed = parsePipelineJobSelectionFromJson("not json", candidates);
        assert.equal(parsed.jobId, null);
        assert.equal(parsed.confidence, "low");
    });
});

describe("resolveSelectionFromParsedPick", () => {
    const candidates = [
        job("cellebrite-1", "QA Engineer", "Cellebrite"),
        job("checkpoint-1", "QA Engineer", "Check Point"),
    ];

    it("resolves Check Point when the model returns its jobId", () => {
        const resolution = resolveSelectionFromParsedPick(
            { jobId: "checkpoint-1", confidence: "high" },
            candidates,
        );
        assert.equal(resolution.status, "resolved");
        if (resolution.status === "resolved") {
            assert.equal(resolution.job.company, "Check Point");
        }
    });

    it("returns ambiguous when jobId is null so callers can ask instead of defaulting", () => {
        const resolution = resolveSelectionFromParsedPick(
            { jobId: null, confidence: "low" },
            candidates,
        );
        assert.equal(resolution.status, "ambiguous");
    });
});

describe("resolvePipelineJobSelection", () => {
    it("returns the only candidate without calling the LLM", async () => {
        let completeCalls = 0;
        const only = job("solo-1", "QA Engineer", "Check Point");
        const resolution = await resolvePipelineJobSelection({
            textCompletion: {
                complete: async () => {
                    completeCalls += 1;
                    return "{}";
                },
            },
            userMessage: "add it",
            candidates: [only],
            focusJobId: only.id,
            userId: "u1",
        });
        assert.equal(completeCalls, 0);
        assert.equal(resolution.status, "resolved");
        if (resolution.status === "resolved") {
            assert.equal(resolution.job.id, "solo-1");
        }
    });

    it("picks Check Point from mocked LLM JSON for a checkpoint message", async () => {
        const candidates = [
            job("cellebrite-1", "QA Engineer", "Cellebrite"),
            job("checkpoint-1", "QA Engineer", "Check Point"),
        ];
        const resolution = await resolvePipelineJobSelection({
            textCompletion: {
                complete: async () => '{"jobId":"checkpoint-1","confidence":"high"}',
            },
            userMessage: "add to my pipeline the qa engineer in checkpoint",
            candidates,
            focusJobId: "cellebrite-1",
            userId: "u1",
        });
        assert.equal(resolution.status, "resolved");
        if (resolution.status === "resolved") {
            assert.equal(resolution.job.id, "checkpoint-1");
            assert.equal(resolution.job.company, "Check Point");
        }
    });

    it("returns ambiguous when the model cannot decide", async () => {
        const candidates = [
            job("cellebrite-1", "QA Engineer", "Cellebrite"),
            job("checkpoint-1", "QA Engineer", "Check Point"),
        ];
        const resolution = await resolvePipelineJobSelection({
            textCompletion: {
                complete: async () => '{"jobId":null,"confidence":"low"}',
            },
            userMessage: "add the qa one",
            candidates,
            focusJobId: "cellebrite-1",
            userId: "u1",
        });
        assert.equal(resolution.status, "ambiguous");
    });
});
