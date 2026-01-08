import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { StatusCodes } from "http-status-codes";
import { Server, type ServerConfig } from "../../../server";
import { mockPipeline, testServerConfig } from "./pipeline-mocks";

describe("Pipeline Router - DELETE /pipelines/:userId/stages/:stage", () => {
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

    it("should delete a stage from the pipeline", async () => {
        const stageToDelete = "in progress";
        const response = await server.app.inject({
            method: "DELETE",
            url: `/pipelines/${testUserId}/stages/${stageToDelete}`,
        });

        expect(response.statusCode).toBe(StatusCodes.OK);
        const pipeline = response.json();
        expect(pipeline.stages).not.toContain(stageToDelete);
        expect(pipeline.stages.length).toBe(mockPipeline.stages.length - 1);

        const dbPipeline = await server.DBClient.pipelines.findOne({ userId: testUserId });
        expect(dbPipeline?.stages).not.toContain(stageToDelete);
    });

    it("should return 404 when deleting stage from non-existent pipeline", async () => {
        const response = await server.app.inject({
            method: "DELETE",
            url: "/pipelines/non-existent-user/stages/watchlist",
        });

        expect(response.statusCode).toBe(StatusCodes.NOT_FOUND);
    });
});

