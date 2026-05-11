import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { StatusCodes } from "http-status-codes";
import { Server, type ServerConfig } from "../../../server";
import { mockPipelineJob, mockUserId, testServerConfig } from "./pipeline-job-mocks";
import { v4 as uuidv4 } from "uuid";

describe("Pipeline Job Router - POST /jobs-in-pipeline", () => {
    const config: ServerConfig = testServerConfig;
    const server = new Server(config);

    beforeAll(async () => {
        await server.start();
    });

    afterAll(async () => {
        await server.DBClient.pipelineJobs.deleteMany({ userId: mockUserId });
        await server.stop();
    });

    afterEach(async () => {
        await server.DBClient.pipelineJobs.deleteMany({ userId: mockUserId });
    });

    it("should create a new pipeline job", async () => {
        const newJobData = {
            userId: mockUserId,
            jobId: 202,
            jobStage: "interview",
            description: "Backend Developer at CloudScale",
        };

        const response = await server.app.inject({
            method: "POST",
            url: "/jobs-in-pipeline",
            payload: newJobData,
        });

        expect(response.statusCode).toBe(StatusCodes.CREATED);
        const createdJob = response.json();
        expect(createdJob.id).toBeDefined();
        expect(createdJob.userId).toBe(mockUserId);
        expect(createdJob.jobId).toBe(newJobData.jobId);

        const dbJob = await server.DBClient.pipelineJobs.findOne({ id: createdJob.id });
        expect(dbJob).toBeDefined();
    });

    it("should return 400 for invalid job data", async () => {
        const response = await server.app.inject({
            method: "POST",
            url: "/jobs-in-pipeline",
            payload: { userId: "invalid-uuid" },
        });

        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
    });

    it("should return 409 when the same user and jobId is added twice", async () => {
        const newJobData = {
            userId: mockUserId,
            jobId: 909090,
            jobStage: "wishlist",
            description: "Test Role at TestCo",
        };

        const first = await server.app.inject({
            method: "POST",
            url: "/jobs-in-pipeline",
            payload: newJobData,
        });
        expect(first.statusCode).toBe(StatusCodes.CREATED);

        const second = await server.app.inject({
            method: "POST",
            url: "/jobs-in-pipeline",
            payload: newJobData,
        });
        expect(second.statusCode).toBe(StatusCodes.CONFLICT);
        const body = second.json() as { error?: string };
        expect(body.error).toContain("already");
    });
});

