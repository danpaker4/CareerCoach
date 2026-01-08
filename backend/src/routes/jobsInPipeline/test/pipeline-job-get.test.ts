import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { StatusCodes } from "http-status-codes";
import { Server, type ServerConfig } from "../../../server";
import { mockPipelineJob, mockPipelineJob2, mockUserId, testServerConfig } from "./pipeline-job-mocks";
import { v4 as uuidv4 } from "uuid";

describe("Pipeline Job Router - GET /jobs-in-pipeline/:userId", () => {
    const config: ServerConfig = testServerConfig;
    const server = new Server(config);

    beforeAll(async () => {
        await server.start();
    });

    afterAll(async () => {
        await server.DBClient.pipelineJobs.deleteMany({ userId: mockUserId });
        await server.stop();
    });

    beforeEach(async () => {
        await server.DBClient.pipelineJobs.insertMany([{ ...mockPipelineJob }, { ...mockPipelineJob2 }]);
    });

    afterEach(async () => {
        await server.DBClient.pipelineJobs.deleteMany({ userId: mockUserId });
    });

    it("should return all jobs for a specific user", async () => {
        const response = await server.app.inject({
            method: "GET",
            url: `/jobs-in-pipeline/${mockUserId}`,
        });

        expect(response.statusCode).toBe(StatusCodes.OK);
        const jobs = response.json();
        expect(Array.isArray(jobs)).toBe(true);
        expect(jobs.length).toBe(2);
        expect(jobs[0].userId).toBe(mockUserId);
        expect(jobs[1].userId).toBe(mockUserId);
    });

    it("should return 404 when no jobs exist for the user", async () => {
        const randomUserId = uuidv4();
        const response = await server.app.inject({
            method: "GET",
            url: `/jobs-in-pipeline/${randomUserId}`,
        });

        expect(response.statusCode).toBe(StatusCodes.NOT_FOUND);
        expect(response.json()).toEqual({
            error: "No jobs found for this user",
        });
    });

    it("should return 400 for invalid userId (not UUID)", async () => {
        const response = await server.app.inject({
            method: "GET",
            url: "/jobs-in-pipeline/invalid-uuid",
        });

        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
    });
});

