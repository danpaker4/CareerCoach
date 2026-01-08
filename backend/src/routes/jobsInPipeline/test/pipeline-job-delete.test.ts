import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { StatusCodes } from "http-status-codes";
import { Server, type ServerConfig } from "../../../server";
import { mockPipelineJob, mockUserId, testServerConfig } from "./pipeline-job-mocks";
import { v4 as uuidv4 } from "uuid";

describe("Pipeline Job Router - DELETE /jobs-in-pipeline/:id", () => {
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

    it("should delete a pipeline job", async () => {
        const response = await server.app.inject({
            method: "DELETE",
            url: `/jobs-in-pipeline/${mockPipelineJob.id}`,
        });

        expect(response.statusCode).toBe(StatusCodes.OK);
        expect(response.json()).toEqual({
            message: `Job ${mockPipelineJob.id} deleted`,
            status: "OK",
        });

        const dbJob = await server.DBClient.pipelineJobs.findOne({ id: mockPipelineJob.id });
        expect(dbJob).toBeNull();
    });

    it("should return 404 when deleting non-existent job", async () => {
        const response = await server.app.inject({
            method: "DELETE",
            url: `/jobs-in-pipeline/${uuidv4()}`,
        });

        expect(response.statusCode).toBe(StatusCodes.NOT_FOUND);
    });
});

