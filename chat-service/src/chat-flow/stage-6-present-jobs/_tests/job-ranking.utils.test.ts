import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { UserCareerProfile } from "../../../routes/career-profile/career-profile.types";
import type { JobSearchResultItem } from "../../api/shared/chat.types";
import { extractRoleTerms, hasRankableProfile, scoreRoleRelevance } from "../ranking/job-ranking.utils";

const profile = (technologies: string[], interests: string[]): UserCareerProfile => ({
    userId: "user-1",
    preferredRoles: [],
    technologies: technologies.map((value) => ({ value, weight: 1 })),
    interests: interests.map((value) => ({ value, weight: 1 })),
    motivations: [],
    constraints: [],
    updatedAt: new Date(),
}) as unknown as UserCareerProfile;

describe("hasRankableProfile", () => {
    it("is true once the profile carries technologies", () => {
        assert.equal(hasRankableProfile(profile(["Node.js"], [])), true);
    });

    it("is true once the profile carries interests", () => {
        assert.equal(hasRankableProfile(profile([], ["backend"])), true);
    });

    it("is false for an empty profile, so the match filter is skipped", () => {
        assert.equal(hasRankableProfile(profile([], [])), false);
    });
});

describe("extractRoleTerms", () => {
    it("keeps the words that identify the role", () => {
        assert.deepEqual(extractRoleTerms("a frontend developer"), ["frontend"]);
    });

    it("drops the request wrapper so it cannot match every posting", () => {
        assert.deepEqual(extractRoleTerms("jobs for a data engineer please now"), ["data"]);
    });

    it("returns nothing when no role was named", () => {
        assert.deepEqual(extractRoleTerms(undefined), []);
        assert.deepEqual(extractRoleTerms("find me some roles"), []);
    });
});

describe("scoreRoleRelevance", () => {
    const posting = (title: string, description: string): JobSearchResultItem => ({
        id: title,
        title,
        company: "ACME",
        seniority: "mid",
        description,
        requirements: [],
        mustKnowSkills: [],
        niceToHaveSkills: [],
        benefits: [],
        salary: null,
        location: null,
        url: "",
    }) as unknown as JobSearchResultItem;

    it("scores a posting whose title answers the request above one that only mentions it", () => {
        const terms = extractRoleTerms("frontend developer");
        const named = scoreRoleRelevance(terms, posting("Frontend Developer", "Build UI."));
        const mentioned = scoreRoleRelevance(terms, posting("Backend Developer", "You will pair with the frontend team."));
        assert.ok(named > mentioned, `${named} should beat ${mentioned}`);
    });

    it("scores an unrelated posting at zero", () => {
        const terms = extractRoleTerms("frontend developer");
        assert.equal(scoreRoleRelevance(terms, posting("Warehouse Coordinator", "Schedule deliveries.")), 0);
    });

    it("scores nothing when the search named no role", () => {
        assert.equal(scoreRoleRelevance([], posting("Frontend Developer", "Build UI.")), 0);
    });
});
