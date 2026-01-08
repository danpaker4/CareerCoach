import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { StatusCodes } from "http-status-codes";
import { Server, type ServerConfig } from "../../../server";
import { mockPipelineJob, mockUserId, testServerConfig } from "./pipeline-job-mocks";
import { v4 as uuidv4 } from "uuid";

describe("Pipeline Job Router - PATCH /jobs-in-pipeline/:id/stage and /description", () => {
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
        await server.DBClient.pipelineJobs.insertOne({ ...mockPipelineJob });
    });

    afterEach(async () => {
        await server.DBClient.pipelineJobs.deleteMany({ userId: mockUserId });
    });

    it("should update job stage", async () => {
        const newStage = "offer";
        const response = await server.app.inject({
            method: "PATCH",
            url: `/jobs-in-pipeline/${mockPipelineJob.id}/stage`,
            payload: { jobStage: newStage },
        });

        expect(response.statusCode).toBe(StatusCodes.OK);
        const updatedJob = response.json();
        expect(updatedJob.jobStage).toBe(newStage);

        const dbJob = await server.DBClient.pipelineJobs.findOne({ id: mockPipelineJob.id });
        expect(dbJob?.jobStage).toBe(newStage);
    });

    it("should update job description", async () => {
        const newDescription = "Senior Software Engineer";
        const response = await server.app.inject({
            method: "PATCH",
            url: `/jobs-in-pipeline/${mockPipelineJob.id}/description`,
            payload: { description: newDescription },
        });

        expect(response.statusCode).toBe(StatusCodes.OK);
        const updatedJob = response.json();
        expect(updatedJob.description).toBe(newDescription);

        const dbJob = await server.DBClient.pipelineJobs.findOne({ id: mockPipelineJob.id });
        expect(dbJob?.description).toBe(newDescription);
    });

    it("should return 404 for non-existent job", async () => {
        const response = await server.app.inject({
            method: "PATCH",
            url: `/jobs-in-pipeline/${uuidv4()}/stage`,
            payload: { jobStage: "some-stage" },
        });

        expect(response.statusCode).toBe(StatusCodes.NOT_FOUND);
    });
});

