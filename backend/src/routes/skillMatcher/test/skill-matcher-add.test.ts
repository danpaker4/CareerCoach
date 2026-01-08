import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { StatusCodes } from "http-status-codes";
import { Server, type ServerConfig } from "../../../server";
import { mockSkillMatcher, mockUserId, testServerConfig } from "./skill-matcher-mocks";

describe("Skill Matcher Router - POST /skill-matcher/:id/skill", () => {
    const config: ServerConfig = testServerConfig;
    const server = new Server(config);

    beforeAll(async () => {
        await server.start();
    });

    afterAll(async () => {
        await server.DBClient.skillMatchers.deleteMany({ userId: mockUserId });
        await server.stop();
    });

    beforeEach(async () => {
        await server.DBClient.skillMatchers.insertOne({ ...mockSkillMatcher });
    });

    afterEach(async () => {
        await server.DBClient.skillMatchers.deleteMany({ userId: mockUserId });
    });

    it("should add a new skill to the skill matcher", async () => {
        const newSkill = { skill: "MongoDB", isDone: false };
        const response = await server.app.inject({
            method: "POST",
            url: `/skill-matcher/${mockSkillMatcher.id}/skill`,
            payload: newSkill,
        });

        expect(response.statusCode).toBe(StatusCodes.OK);
        const updatedSkillMatcher = response.json();
        expect(updatedSkillMatcher.skillToImprove.length).toBe(mockSkillMatcher.skillToImprove.length + 1);
        expect(updatedSkillMatcher.skillToImprove).toContainEqual(newSkill);

        const dbSkillMatcher = await server.DBClient.skillMatchers.findOne({ id: mockSkillMatcher.id });
        expect(dbSkillMatcher?.skillToImprove).toContainEqual(newSkill);
    });

    it("should return 404 when skill matcher does not exist", async () => {
        const response = await server.app.inject({
            method: "POST",
            url: `/skill-matcher/${mockUserId}/skill`,
            payload: { skill: "New Skill", isDone: false },
        });

        expect(response.statusCode).toBe(StatusCodes.NOT_FOUND);
    });
});

