import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { StatusCodes } from "http-status-codes";
import { Server, type ServerConfig } from "../../../server";
import { mockCareerRoadMap, mockCareerRoadMap2, mockUserId, testServerConfig } from "./career-roadmap-mocks";
import { v4 as uuidv4 } from "uuid";

describe("Career Road Map Router - GET /career-roadmap/:userId", () => {
    const config: ServerConfig = testServerConfig;
    const server = new Server(config);

    beforeAll(async () => {
        await server.start();
    });

    afterAll(async () => {
        await server.DBClient.careerRoadMaps.deleteMany({ userId: mockUserId });
        await server.stop();
    });

    beforeEach(async () => {
        await server.DBClient.careerRoadMaps.insertMany([{ ...mockCareerRoadMap }, { ...mockCareerRoadMap2 }]);
    });

    afterEach(async () => {
        await server.DBClient.careerRoadMaps.deleteMany({ userId: mockUserId });
    });

    it("should return all career road maps for a specific user", async () => {
        const response = await server.app.inject({
            method: "GET",
            url: `/career-roadmap/${mockUserId}`,
        });

        expect(response.statusCode).toBe(StatusCodes.OK);
        const roadMaps = response.json();
        expect(Array.isArray(roadMaps)).toBe(true);
        expect(roadMaps.length).toBe(2);
        expect(roadMaps[0].userId).toBe(mockUserId);
        expect(roadMaps[1].userId).toBe(mockUserId);
    });

    it("should return 200 with an empty array when no career road maps exist for the user", async () => {
        const randomUserId = uuidv4();
        const response = await server.app.inject({
            method: "GET",
            url: `/career-roadmap/${randomUserId}`,
        });

        expect(response.statusCode).toBe(StatusCodes.OK);
        expect(response.json()).toEqual([]);
    });

    it("should return 400 for invalid userId (not UUID)", async () => {
        const response = await server.app.inject({
            method: "GET",
            url: "/career-roadmap/invalid-uuid",
        });

        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
    });
});

