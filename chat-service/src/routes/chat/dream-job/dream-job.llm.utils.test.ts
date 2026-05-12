import { describe, expect, it } from "vitest";
import { parseDreamJobPayloadFromRaw } from "./dream-job.llm.utils";

describe("parseDreamJobPayloadFromRaw", () => {
    it("parses plain JSON", () => {
        const raw = '{"dreamJob":"Platform Engineer","confidence":82,"reasoning":["Likes systems"]}';
        const r = parseDreamJobPayloadFromRaw(raw);
        expect(r?.dreamJob).toBe("Platform Engineer");
        expect(r?.confidence).toBe(82);
        expect(r?.reasoning).toEqual(["Likes systems"]);
    });

    it("parses fenced JSON", () => {
        const raw = '```json\n{"dreamJob":"Designer","confidence":75,"reasoning":["a","b"]}\n```';
        const r = parseDreamJobPayloadFromRaw(raw);
        expect(r?.dreamJob).toBe("Designer");
    });

    it("returns null when dream job empty", () => {
        expect(parseDreamJobPayloadFromRaw('{"dreamJob":"","confidence":90,"reasoning":[]}')).toBeNull();
    });
});
