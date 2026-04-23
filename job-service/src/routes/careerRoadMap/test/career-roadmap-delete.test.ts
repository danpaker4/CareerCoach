import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { StatusCodes } from "http-status-codes";
import { Server, type ServerConfig } from "../../../server";
import { mockCareerRoadMap, mockUserId, testServerConfig } from "./career-roadmap-mocks";
import { v4 as uuidv4 } from "uuid";

describe("Career Road Map Router - DELETE /career-roadmap/:id", () => {
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
        await server.DBClient.careerRoadMaps.insertOne({ ...mockCareerRoadMap });
    });

    afterEach(async () => {
        await server.DBClient.careerRoadMaps.deleteMany({ userId: mockUserId });
    });

    it("should delete a career road map", async () => {
        const response = await server.app.inject({
            method: "DELETE",
            url: `/career-roadmap/${mockCareerRoadMap.id}`,
        });

        expect(response.statusCode).toBe(StatusCodes.OK);
        expect(response.json()).toEqual({
            message: `Career road map ${mockCareerRoadMap.id} deleted`,
            status: "OK",
        });

        const dbRoadMap = await server.DBClient.careerRoadMaps.findOne({ id: mockCareerRoadMap.id });
        expect(dbRoadMap).toBeNull();
    });

    it("should return 404 when deleting non-existent career road map", async () => {
        const response = await server.app.inject({
            method: "DELETE",
            url: `/career-roadmap/${uuidv4()}`,
        });

        expect(response.statusCode).toBe(StatusCodes.NOT_FOUND);
    });
});

