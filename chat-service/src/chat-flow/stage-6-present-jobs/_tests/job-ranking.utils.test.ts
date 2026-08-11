import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { UserCareerProfile } from "../../../routes/career-profile/career-profile.types";
import { hasRankableProfile } from "../ranking/job-ranking.utils";

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
