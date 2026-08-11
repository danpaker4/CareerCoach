import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildWorkDirectionFilters } from "../chat.direction.utils";
import { filterJobsMatchingSearchQuery } from "../../../stage-6-present-jobs/ranking/job-ranking.service";
import type { JobSearchResultItem } from "../../../api/shared/chat.types";

const job = (title: string, description = ""): JobSearchResultItem => ({
    id: title,
    title,
    company: "Co",
    location: "",
    seniority: "mid",
    description,
    url: "https://example.com",
    salary: 0,
    requirements: [],
    mustKnowSkills: [],
    niceToHaveSkills: [],
    benefits: [],
});

describe("buildWorkDirectionFilters QA", () => {
    it("expands QA direction with QA-specific keywords", () => {
        const filters = buildWorkDirectionFilters("QA Automation & Performance Engineer");
        assert.ok(filters.keywords.some((keyword) => /qa/i.test(keyword)));
        assert.ok(filters.keywords.some((keyword) => /quality assurance/i.test(keyword)));
        assert.equal(filters.skills.length, 0);
    });
});

describe("filterJobsMatchingSearchQuery", () => {
    it("keeps QA jobs and drops unrelated backend/devops near-misses", () => {
        const filtered = filterJobsMatchingSearchQuery(
            "QA Quality Assurance Test Automation SDET",
            [
                job("QA Automation Engineer", "Selenium and Cypress"),
                job("Backend Engineer", "Node.js APIs"),
                job("DevOps Engineer", "Kubernetes and CI"),
            ],
        );
        assert.deepEqual(filtered.map((item) => item.title), ["QA Automation Engineer"]);
    });
});
