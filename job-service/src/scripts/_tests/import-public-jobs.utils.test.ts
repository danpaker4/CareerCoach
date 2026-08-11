import { describe, expect, it } from "vitest";
import {
    htmlToText,
    inferSeniority,
    looksEnglish,
    parseYearlySalary,
    requirementsFromTags,
} from "../import-public-jobs.utils";

describe("inferSeniority", () => {
    it("reads the level from the title", () => {
        expect(inferSeniority("Senior Backend Engineer")).toBe("senior");
        expect(inferSeniority("Junior QA Engineer")).toBe("junior");
        expect(inferSeniority("Engineering Manager")).toBe("manager");
        expect(inferSeniority("Software Engineering Intern")).toBe("intern");
    });

    it("prefers a declared level over the title", () => {
        expect(inferSeniority("Backend Engineer", "Senior")).toBe("senior");
    });

    it("ignores a placeholder level", () => {
        expect(inferSeniority("Senior Data Engineer", "any")).toBe("senior");
    });

    it("defaults to mid when nothing indicates a level", () => {
        expect(inferSeniority("Backend Engineer")).toBe("mid");
    });
});

describe("htmlToText", () => {
    it("keeps paragraph breaks and drops markup", () => {
        expect(htmlToText("<p>First line</p><p>Second line</p>")).toBe("First line\nSecond line");
    });

    it("decodes the common entities", () => {
        expect(htmlToText("<p>R&amp;D &quot;team&quot;</p>")).toBe('R&D "team"');
    });
});

describe("parseYearlySalary", () => {
    it("expands a k suffix", () => {
        expect(parseYearlySalary("$120k")).toBe(120_000);
    });

    it("averages a range", () => {
        expect(parseYearlySalary("OTE $100k - $140k")).toBe(120_000);
    });

    it("returns undefined when there is no usable figure", () => {
        expect(parseYearlySalary("competitive")).toBeUndefined();
        expect(parseYearlySalary(undefined)).toBeUndefined();
    });
});

describe("requirementsFromTags", () => {
    it("keeps clean string tags", () => {
        expect(requirementsFromTags(["React", " Node.js ", ""])).toEqual(["React", "Node.js"]);
    });

    it("returns undefined when nothing usable remains", () => {
        expect(requirementsFromTags([])).toBeUndefined();
        expect(requirementsFromTags(undefined)).toBeUndefined();
    });
});

describe("looksEnglish", () => {
    it("rejects a German posting", () => {
        expect(looksEnglish(
            "Payroll Specialist (m/w/d)",
            "Wir suchen einen Mitarbeiter für unsere Buchhaltung und bieten eine Ausbildung."
        )).toBe(false);
    });

    it("accepts an English posting", () => {
        expect(looksEnglish(
            "Senior Backend Engineer",
            "We are looking for a backend engineer to design APIs and own data models."
        )).toBe(true);
    });
});
