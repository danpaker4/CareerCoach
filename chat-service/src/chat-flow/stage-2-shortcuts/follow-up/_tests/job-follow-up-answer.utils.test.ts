import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SanitizedJob } from "../../../../routes/conversation/job-in-conversation.types";
import { resolveJobSelectionFromFollowUpMessage } from "../job-follow-up-answer.utils";

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

describe("resolveJobSelectionFromFollowUpMessage", () => {
    it("resolves a job when the user mentions a partial company name", () => {
        const pixelPerfect = job("pixel-1", "Frontend Developer (React)", "Pixel Perfect Labs");
        const wolt = job("wolt-1", "Frontend Developer (React)", "Wolt Israel");

        const resolution = resolveJobSelectionFromFollowUpMessage(
            "what the salary at frontend developer in pixel perfect",
            null,
            [pixelPerfect, wolt],
        );

        assert.equal(resolution.status, "resolved");
        if (resolution.status === "resolved") {
            assert.equal(resolution.job.id, "pixel-1");
        }
    });

    it("resolves an explicitly named job from an earlier search instead of the current selection", () => {
        const earlierJob = job("earlier-1", "Backend Engineer", "Acme Systems");
        const currentJob = job("current-1", "Frontend Engineer", "Current Labs");

        const resolution = resolveJobSelectionFromFollowUpMessage(
            "what is the salary for the backend engineer at Acme?",
            currentJob,
            [currentJob],
            [earlierJob, currentJob],
        );

        assert.equal(resolution.status, "resolved");
        if (resolution.status === "resolved") {
            assert.equal(resolution.job.id, "earlier-1");
        }
    });

    it("keeps ordinal references scoped to the most recent search", () => {
        const earlierJob = job("earlier-1", "Backend Engineer", "Acme Systems");
        const currentFirst = job("current-1", "Frontend Engineer", "Current Labs");
        const currentSecond = job("current-2", "Platform Engineer", "Modern Systems");

        const resolution = resolveJobSelectionFromFollowUpMessage(
            "tell me more about the second one",
            currentFirst,
            [currentFirst, currentSecond],
            [earlierJob, currentFirst, currentSecond],
        );

        assert.equal(resolution.status, "resolved");
        if (resolution.status === "resolved") {
            assert.equal(resolution.job.id, "current-2");
        }
    });
});
