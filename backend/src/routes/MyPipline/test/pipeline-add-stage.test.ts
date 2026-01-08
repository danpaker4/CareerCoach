import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { StatusCodes } from "http-status-codes";
import { Server, type ServerConfig } from "../../../server";
import { mockPipeline, testServerConfig } from "./pipeline-mocks";

describe("Pipeline Router - POST /pipelines/:userId/stages", () => {
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

    it("should add a new stage to the pipeline", async () => {
        const newStage = "interviewing";
        const response = await server.app.inject({
            method: "POST",
            url: `/pipelines/${testUserId}/stages`,
            payload: { stage: newStage },
        });

        expect(response.statusCode).toBe(StatusCodes.OK);
        const pipeline = response.json();
        expect(pipeline.stages).toContain(newStage);
        expect(pipeline.stages.length).toBe(mockPipeline.stages.length + 1);

        const dbPipeline = await server.DBClient.pipelines.findOne({ userId: testUserId });
        expect(dbPipeline?.stages).toContain(newStage);
    });

    it("should return 404 when adding stage to non-existent pipeline", async () => {
        const response = await server.app.inject({
            method: "POST",
            url: "/pipelines/non-existent-user/stages",
            payload: { stage: "new-stage" },
        });

        expect(response.statusCode).toBe(StatusCodes.NOT_FOUND);
    });
});

