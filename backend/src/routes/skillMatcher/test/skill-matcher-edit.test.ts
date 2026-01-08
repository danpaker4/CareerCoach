import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { StatusCodes } from "http-status-codes";
import { Server, type ServerConfig } from "../../../server";
import { mockSkillMatcher, mockUserId, testServerConfig } from "./skill-matcher-mocks";

describe("Skill Matcher Router - PATCH /skill-matcher/:userId/:jobId/:skill", () => {
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

    it("should update isDone to true for a skill", async () => {
        const skillName = "TypeScript";
        const response = await server.app.inject({
            method: "PATCH",
            url: `/skill-matcher/${mockUserId}/${mockSkillMatcher.jobId}/${skillName}`,
            payload: { isDone: true },
        });

        expect(response.statusCode).toBe(StatusCodes.OK);
        const updatedSkillMatcher = response.json();
        const skill = updatedSkillMatcher.skillToImprove.find((s: any) => s.skill === skillName);
        expect(skill).toBeDefined();
        expect(skill.isDone).toBe(true);

        const dbSkillMatcher = await server.DBClient.skillMatchers.findOne({ userId: mockUserId, jobId: mockSkillMatcher.jobId });
        const dbSkill = dbSkillMatcher?.skillToImprove.find((s) => s.skill === skillName);
        expect(dbSkill?.isDone).toBe(true);
    });

    it("should update isDone to false for a skill", async () => {
        const skillName = "React";
        const response = await server.app.inject({
            method: "PATCH",
            url: `/skill-matcher/${mockUserId}/${mockSkillMatcher.jobId}/${skillName}`,
            payload: { isDone: false },
        });

        expect(response.statusCode).toBe(StatusCodes.OK);
        const updatedSkillMatcher = response.json();
        const skill = updatedSkillMatcher.skillToImprove.find((s: any) => s.skill === skillName);
        expect(skill).toBeDefined();
        expect(skill.isDone).toBe(false);
    });

    it("should return 404 when skill matcher does not exist", async () => {
        const response = await server.app.inject({
            method: "PATCH",
            url: `/skill-matcher/${mockUserId}/999/TypeScript`,
            payload: { isDone: true },
        });

        expect(response.statusCode).toBe(StatusCodes.NOT_FOUND);
    });

    it("should return 404 when skill does not exist", async () => {
        const response = await server.app.inject({
            method: "PATCH",
            url: `/skill-matcher/${mockUserId}/${mockSkillMatcher.jobId}/NonExistentSkill`,
            payload: { isDone: true },
        });

        expect(response.statusCode).toBe(StatusCodes.NOT_FOUND);
    });
});

