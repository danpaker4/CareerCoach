import { describe, expect, it } from "vitest";
import { JobSelectionResolverService } from "./job-selection-resolver.service";
import type { SanitizedJob } from "./job-context.types";

const JOBS: SanitizedJob[] = [
    {
        id: "1",
        title: "Full Stack Developer",
        company: "Wix",
        seniority: "junior",
        description: "React and Node",
        requirements: [],
        mustKnowSkills: [],
        niceToHaveSkills: [],
        benefits: [],
        salary: null,
        location: null,
        url: "u1",
    },
    {
        id: "2",
        title: "Backend Engineer",
        company: "Pitango",
        seniority: "mid",
        description: "Node and MongoDB",
        requirements: [],
        mustKnowSkills: [],
        niceToHaveSkills: [],
        benefits: [],
        salary: null,
        location: null,
        url: "u2",
    },
];

describe("JobSelectionResolverService", () => {
    const service = new JobSelectionResolverService();

    it("resolves first job by ordinal", () => {
        const result = service.resolve("the first one", null, JOBS);
        expect(result.status).toBe("resolved");
        if (result.status === "resolved") {
            expect(result.job.id).toBe("1");
        }
    });

    it("resolves job by company mention", () => {
        const result = service.resolve("the Wix job", null, JOBS);
        expect(result.status).toBe("resolved");
        if (result.status === "resolved") {
            expect(result.job.company).toBe("Wix");
        }
    });

    it("returns ambiguous when it cannot resolve among many jobs", () => {
        const result = service.resolve("what are the requirements?", null, JOBS);
        expect(result.status).toBe("ambiguous");
    });
});
