import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { StatusCodes } from "http-status-codes";
import { Server, type ServerConfig } from "../../../server";
import { mockCareerRoadMap, mockUserId, testServerConfig } from "./career-roadmap-mocks";
import { v4 as uuidv4 } from "uuid";

describe("Career Road Map Router - PATCH /career-roadmap/:id/stages", () => {
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

    it("should update stages to dream job", async () => {
        const updatedStages = [
            { jobId: 101, isDone: true },
            { jobId: 102, isDone: true },
            { jobId: 103, isDone: true },
            { jobId: 104, isDone: false },
        ];

        const response = await server.app.inject({
            method: "PATCH",
            url: `/career-roadmap/${mockCareerRoadMap.id}/stages`,
            payload: { stagesToDreamJob: updatedStages },
        });

        expect(response.statusCode).toBe(StatusCodes.OK);
        const updatedRoadMap = response.json();
        expect(updatedRoadMap.stagesToDreamJob).toEqual(updatedStages);
        expect(updatedRoadMap.stagesToDreamJob.length).toBe(4);

        const dbRoadMap = await server.DBClient.careerRoadMaps.findOne({ id: mockCareerRoadMap.id });
        expect(dbRoadMap?.stagesToDreamJob).toEqual(updatedStages);
    });

    it("should replace all stages with new ones", async () => {
        const newStages = [{ jobId: 301, isDone: false }];

        const response = await server.app.inject({
            method: "PATCH",
            url: `/career-roadmap/${mockCareerRoadMap.id}/stages`,
            payload: { stagesToDreamJob: newStages },
        });

        expect(response.statusCode).toBe(StatusCodes.OK);
        const updatedRoadMap = response.json();
        expect(updatedRoadMap.stagesToDreamJob).toEqual(newStages);
        expect(updatedRoadMap.stagesToDreamJob.length).toBe(1);
    });

    it("should return 404 when career road map does not exist", async () => {
        const response = await server.app.inject({
            method: "PATCH",
            url: `/career-roadmap/${uuidv4()}/stages`,
            payload: { stagesToDreamJob: [{ jobId: 999, isDone: true }] },
        });

        expect(response.statusCode).toBe(StatusCodes.NOT_FOUND);
    });
});

