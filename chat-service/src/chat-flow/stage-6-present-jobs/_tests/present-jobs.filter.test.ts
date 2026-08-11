import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Conversation } from "../../../routes/conversation/conversation.model";
import type { UserCareerProfile } from "../../../routes/career-profile/career-profile.types";
import type { JobSearchResultItem } from "../../api/shared/chat.types";
import { filterEligibleRankedJobs } from "../present-jobs";

const profile = (technologies: string[]): UserCareerProfile => ({
    userId: "user-1",
    technologies: technologies.map((value) => ({ value, weight: 1 })),
    interests: [],
    preferredRoles: [],
    motivations: [],
    constraints: [],
    updatedAt: new Date(),
}) as unknown as UserCareerProfile;

const job = (id: string, title: string, description: string, requirements: string[] = []): JobSearchResultItem => ({
    id,
    title,
    company: "ACME",
    seniority: "mid",
    description,
    requirements,
    mustKnowSkills: [],
    niceToHaveSkills: [],
    benefits: [],
    salary: null,
    location: null,
    url: "",
}) as unknown as JobSearchResultItem;

const emptyConversation = { jobContext: undefined } as unknown as Conversation;

const RELEVANT = job("relevant", "Backend Engineer",
    "Build services with Node.js and TypeScript against MongoDB.");
const IRRELEVANT = job("irrelevant", "Warehouse Coordinator",
    "Coordinate shipments, manage stock levels and schedule deliveries for the depot.");

describe("filterEligibleRankedJobs", () => {
    it("drops jobs that do not clear the match threshold once the profile has signal", () => {
        const { orderedRankedPool } = filterEligibleRankedJobs(
            profile(["Node.js", "TypeScript", "MongoDB"]),
            [RELEVANT, IRRELEVANT],
            emptyConversation
        );
        assert.deepEqual(orderedRankedPool.map((item) => item.jobId), ["relevant"]);
    });

    it("keeps every job when the profile has nothing to match against", () => {
        const { orderedRankedPool } = filterEligibleRankedJobs(
            profile([]),
            [RELEVANT, IRRELEVANT],
            emptyConversation
        );
        assert.equal(orderedRankedPool.length, 2);
    });

    it("scores against the structured skill fields, not only the description", () => {
        const skillsOnly = job("skills-only", "Platform Engineer",
            "Own the internal developer platform and its golden paths.",
            ["Node.js", "TypeScript", "MongoDB"]);
        const { orderedRankedPool } = filterEligibleRankedJobs(
            profile(["Node.js", "TypeScript", "MongoDB"]),
            [skillsOnly],
            emptyConversation
        );
        assert.equal(orderedRankedPool.length, 1);
    });

    it("reports when everything was removed by the match threshold", () => {
        const { orderedRankedPool, filteredOutByMatch } = filterEligibleRankedJobs(
            profile(["Node.js", "TypeScript", "MongoDB"]),
            [IRRELEVANT],
            emptyConversation
        );
        assert.equal(orderedRankedPool.length, 0);
        assert.equal(filteredOutByMatch, true);
    });

    it("does not report a match-threshold removal when there was nothing eligible to begin with", () => {
        const { filteredOutByMatch } = filterEligibleRankedJobs(
            profile(["Node.js"]),
            [],
            emptyConversation
        );
        assert.equal(filteredOutByMatch, false);
    });
});
