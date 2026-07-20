import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { StatusCodes } from "http-status-codes";
import { Server, type ServerConfig } from "../../../server";
import { mockPipeline, testServerConfig } from "./pipeline-mocks";

describe("Pipeline Router - GET /pipelines/:userId", () => {
    const config: ServerConfig = testServerConfig;
    const server = new Server(config);
    const testUserId = mockPipeline.userId;

    beforeAll(async () => {
        await server.start();
    });

    afterAll(async () => {
        await server.DBClient.pipelines.deleteMany({ userId: testUserId });
        await server.stop();
    });

    beforeEach(async () => {
        await server.DBClient.pipelines.insertOne({ ...mockPipeline });
    });

    afterEach(async () => {
        await server.DBClient.pipelines.deleteMany({ userId: testUserId });
    });

    it("should return pipeline when user exists", async () => {
        const response = await server.app.inject({
            method: "GET",
            url: `/pipelines/${testUserId}`,
        });

        expect(response.statusCode).toBe(StatusCodes.OK);
        const pipeline = response.json();
        expect(pipeline.userId).toBe(testUserId);
        expect(pipeline.stages).toEqual(mockPipeline.stages);
    });

    it("should return 404 when pipeline does not exist", async () => {
        const response = await server.app.inject({
            method: "GET",
            url: "/pipelines/non-existent-user",
        });

        expect(response.statusCode).toBe(StatusCodes.NOT_FOUND);
        expect(response.json()).toEqual({
            error: "Pipeline not found",
        });
    });
});

