import { describe, expect, it } from "vitest";
import { buildUserAccountContext } from "./chat.user-account-context.utils";

describe("buildUserAccountContext", () => {
    it("returns default message when no data", () => {
        expect(buildUserAccountContext({ serverUser: null, profile: null })).toContain("No structured account context");
    });

    it("merges client profile with server user", () => {
        const text = buildUserAccountContext({
            serverUser: {
                githubSkills: ["TypeScript"],
                technologies: ["React"],
                cv: "Worked as engineer for 5 years.",
            },
            profile: {
                firstName: "Gal",
                lastName: "Test",
                githubSkills: ["Node"],
                cvExcerpt: "Summary from client.",
            },
        });
        expect(text).toContain("Name: Gal Test");
        expect(text).toContain("GitHub-derived skills:");
        expect(text).toMatch(/TypeScript|Node/);
        expect(text).toContain("CV excerpt");
        expect(text).toContain("Summary from client.");
    });

    it("prefers client cvExcerpt over server cv when both exist", () => {
        const text = buildUserAccountContext({
            serverUser: { cv: "SERVER_CV" },
            profile: { cvExcerpt: "CLIENT_CV" },
        });
        expect(text).toContain("CLIENT_CV");
        expect(text).not.toContain("SERVER_CV");
    });
});
