import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { StatusCodes } from "http-status-codes";
import { Server, type ServerConfig } from "../../../server";
import { mockSkillMatcher, mockSkillMatcher2, mockUserId, testServerConfig } from "./skill-matcher-mocks";
import { v4 as uuidv4 } from "uuid";

describe("Skill Matcher Router - GET /skill-matcher/:userId", () => {
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
        await server.DBClient.skillMatchers.insertMany([{ ...mockSkillMatcher }, { ...mockSkillMatcher2 }]);
    });

    afterEach(async () => {
        await server.DBClient.skillMatchers.deleteMany({ userId: mockUserId });
    });

    it("should return all skill matchers for a specific user", async () => {
        const response = await server.app.inject({
            method: "GET",
            url: `/skill-matcher/${mockUserId}`,
        });

        expect(response.statusCode).toBe(StatusCodes.OK);
        const skillMatchers = response.json();
        expect(Array.isArray(skillMatchers)).toBe(true);
        expect(skillMatchers.length).toBe(2);
        expect(skillMatchers[0].userId).toBe(mockUserId);
        expect(skillMatchers[1].userId).toBe(mockUserId);
    });

    it("should return 404 when no skill matchers exist for the user", async () => {
        const randomUserId = uuidv4();
        const response = await server.app.inject({
            method: "GET",
            url: `/skill-matcher/${randomUserId}`,
        });

        expect(response.statusCode).toBe(StatusCodes.NOT_FOUND);
        expect(response.json()).toEqual({
            error: "No skill matchers found for this user",
        });
    });

    it("should return 400 for invalid userId (not UUID)", async () => {
        const response = await server.app.inject({
            method: "GET",
            url: "/skill-matcher/invalid-uuid",
        });

        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
    });
});

