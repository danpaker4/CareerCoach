import { describe, expect, it } from "vitest";
import {
    buildBroaderJobSearchFilters,
    buildDomainExplorationFilters,
    buildWorkDirectionFilters,
    detectDomainExplorationTarget,
    extractWorkDirectionQuery,
    isStageSkipRequested,
    isWorkDirectionIntent,
    shouldRunJobSearch,
} from "./chat.direction.utils";
import {
    JOB_SEARCH_DEEP_DISCOVERY_DISCOVERY_MIN,
    JOB_SEARCH_READINESS_DEFAULT_MIN,
    JOB_SEARCH_READINESS_FAST_SEARCH_MIN,
} from "./chat.service.consts";
import type { UserCareerProfile } from "../career-profile/career-profile.types";
import { createEmptyProfileSignals } from "../career-profile/career-profile.utils";

const emptyProfile = (userId: string): UserCareerProfile => {
    const now = new Date();
    return {
        userId,
        ...createEmptyProfileSignals(),
        salaryExpectation: null,
        locationPreference: null,
        remotePreference: null,
        senioritySignal: null,
        uncertaintyLevel: 0.5,
        profileSummaryText: "",
        profileSummaryEmbedding: [],
        createdAt: now,
        updatedAt: now,
    };
};

describe("chat.direction.utils — work direction → job search intent", () => {
    it("detects explicit role phrasing (I want to be …)", () => {
        const message = "I want to be a React developer";
        expect(isWorkDirectionIntent(message)).toBe(true);
        expect(extractWorkDirectionQuery(message)).toBe("a React developer");
    });

    it("detects search-me-a-job phrasing", () => {
        const message = "search me a job as a backend engineer";
        expect(isWorkDirectionIntent(message)).toBe(true);
        expect(extractWorkDirectionQuery(message)).toBe("backend engineer");
    });

    it("detects find-me … jobs phrasing", () => {
        const message = "find me data analyst jobs";
        expect(isWorkDirectionIntent(message)).toBe(true);
        expect(extractWorkDirectionQuery(message)).toBe("data analyst");
    });

    it("detects domain + jobs/work/role language", () => {
        const message = "I am curious about devops roles";
        expect(isWorkDirectionIntent(message)).toBe(true);
    });

    it("does not treat a generic greeting as work direction", () => {
        expect(isWorkDirectionIntent("hello, how are you?")).toBe(false);
        expect(extractWorkDirectionQuery("hello")).toBeNull();
    });
});

describe("chat.direction.utils — stage skip", () => {
    it("recognizes skip-to-jobs style messages", () => {
        expect(isStageSkipRequested("please skip to jobs")).toBe(true);
        expect(isStageSkipRequested("show me jobs in Tel Aviv")).toBe(true);
    });
});

describe("chat.direction.utils — domain exploration", () => {
    it("returns a domain target when user asks what exists in a known domain", () => {
        const target = detectDomainExplorationTarget("what jobs are there in cybersecurity?");
        expect(target?.domain).toBe("cybersecurity");
    });
});

describe("chat.direction.utils — shouldRunJobSearch", () => {
    it("forces search when domain exploration / work direction sets force flag", () => {
        expect(shouldRunJobSearch("GUIDED", false, 0, 0, true)).toBe(true);
    });

    it("searches in FAST_SEARCH when readiness meets fast threshold", () => {
        expect(shouldRunJobSearch("FAST_SEARCH", false, JOB_SEARCH_READINESS_FAST_SEARCH_MIN, 0, false)).toBe(true);
        expect(shouldRunJobSearch("FAST_SEARCH", false, JOB_SEARCH_READINESS_FAST_SEARCH_MIN - 1, 0, false)).toBe(false);
    });

    it("searches when readiness meets default threshold", () => {
        expect(shouldRunJobSearch("GUIDED", false, JOB_SEARCH_READINESS_DEFAULT_MIN, 0, false)).toBe(true);
        expect(shouldRunJobSearch("GUIDED", false, JOB_SEARCH_READINESS_DEFAULT_MIN - 1, 0, false)).toBe(false);
    });

    it("searches in DEEP_DISCOVERY when discovery confidence is high enough", () => {
        expect(shouldRunJobSearch("DEEP_DISCOVERY", false, 0, JOB_SEARCH_DEEP_DISCOVERY_DISCOVERY_MIN, false)).toBe(true);
        expect(shouldRunJobSearch("DEEP_DISCOVERY", false, 0, JOB_SEARCH_DEEP_DISCOVERY_DISCOVERY_MIN - 1, false)).toBe(false);
    });

    it("falls back to LLM shouldSearch when rules do not fire", () => {
        expect(shouldRunJobSearch("GUIDED", true, 0, 0, false)).toBe(true);
        expect(shouldRunJobSearch("GUIDED", false, 0, 0, false)).toBe(false);
    });
});

describe("chat.direction.utils — filter builders", () => {
    it("buildWorkDirectionFilters carries direction into interests and keywords", () => {
        const filters = buildWorkDirectionFilters("Platform engineer");
        expect(filters.interests).toContain("Platform engineer");
        expect(filters.keywords.join(" ")).toMatch(/Platform/i);
    });

    it("buildDomainExplorationFilters merges target role hints", () => {
        const target = detectDomainExplorationTarget("what can I become in ai?");
        expect(target).not.toBeNull();
        if (!target) {
            return;
        }
        const merged = buildDomainExplorationFilters(
            target,
            { skills: [], interests: [], experienceLevel: "", keywords: ["seed"] },
            [{ value: "Python" }]
        );
        expect(merged.interests).toEqual(expect.arrayContaining(["ai"]));
        expect(merged.keywords.some((k) => k.includes("ML") || k.includes("AI"))).toBe(true);
    });

    it("buildBroaderJobSearchFilters prefers last search query from job context", () => {
        const profile = emptyProfile("user-1");
        const filters = buildBroaderJobSearchFilters({ lastSearchQuery: "SOC analyst" } as never, profile);
        expect(filters.interests.some((i) => i.toLowerCase().includes("soc"))).toBe(true);
    });
});
