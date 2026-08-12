import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
    applyChatStatedFactsToBackground,
    doesReplyMatchChatStatedFacts,
    extractChatStatedBackgroundFacts,
    extractClaimedYearsOfExperience,
    formatChatStatedFactsForPrompt,
} from "../onboarding.chat-facts.utils";

describe("onboarding chat facts", () => {
    it("extracts a name, role, and tenure stated in chat", () => {
        const message = "hi my name is gal kosover and in the last 5 years im software developer";
        const facts = extractChatStatedBackgroundFacts(message);

        assert.equal(facts.name, "gal kosover");
        assert.equal(facts.role, "software developer");
        assert.equal(facts.yearsOfExperience, 5);
        assert.equal(formatChatStatedFactsForPrompt(facts), "name=gal kosover, role=software developer, yearsOfExperience=5");
    });

    it("does not reinterpret a job-search request as the user's current profession", () => {
        const facts = extractChatStatedBackgroundFacts("i am looking for a new role");

        assert.equal(facts.role, undefined);
    });

    it("extracts years from common tenure phrasings", () => {
        assert.equal(extractClaimedYearsOfExperience("for the last 3 years I am a developer"), 3);
        assert.equal(extractClaimedYearsOfExperience("I have 8 years of experience"), 8);
        assert.equal(extractClaimedYearsOfExperience("5 years as a tester"), 5);
        assert.equal(extractClaimedYearsOfExperience("hello there"), undefined);
    });

    it("overrides CV role and years while keeping company enrichment", () => {
        const merged = applyChatStatedFactsToBackground(
            {
                status: "FOUND",
                role: "QA Automation & Performance Engineer",
                yearsOfExperience: 2,
                companies: ["IDF"],
                summary: "QA Automation & Performance Engineer for about 2 years at IDF",
            },
            { role: "qa", yearsOfExperience: 5 },
        );

        assert.equal(merged.role, "qa");
        assert.equal(merged.yearsOfExperience, 5);
        assert.deepEqual(merged.companies, ["IDF"]);
        assert.equal(merged.summary, "qa for about 5 years at IDF");
    });

    it("accepts model replies only when all mentioned role and tenure facts match chat", () => {
        const facts = { role: "software developer", yearsOfExperience: 5 };

        assert.equal(
            doesReplyMatchChatStatedFacts("Nice — software developer for about 5 years. What are you looking for?", facts),
            true,
        );
        assert.equal(
            doesReplyMatchChatStatedFacts("Nice — QA engineer for about 2 years. What are you looking for?", facts),
            false,
        );
        assert.equal(
            doesReplyMatchChatStatedFacts("Software developer for 5 years, after 2 years in QA.", facts),
            false,
        );
    });
});
