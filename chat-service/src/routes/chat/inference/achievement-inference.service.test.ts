import { describe, expect, it } from "vitest";
import { AchievementInferenceService } from "./achievement-inference.service";

describe("AchievementInferenceService", () => {
    it("infers deeper skills from concrete message", () => {
        const service = new AchievementInferenceService();
        const result = service.inferFromMessage("I built automation tests with Cypress and worked with Redis and Kafka.");
        expect(result.achievements.length).toBeGreaterThan(0);
        const inferred = result.achievements.flatMap((item) => item.inferredSkills.join(" "));
        expect(inferred.join(" ")).toContain("distributed");
    });
});
