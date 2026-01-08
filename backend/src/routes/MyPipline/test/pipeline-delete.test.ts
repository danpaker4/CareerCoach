import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { StatusCodes } from "http-status-codes";
import { Server, type ServerConfig } from "../../../server";
import { mockPipeline, testServerConfig } from "./pipeline-mocks";

describe("Pipeline Router - DELETE /pipelines/:userId", () => {
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

    it("should delete the entire pipeline", async () => {
        const response = await server.app.inject({
            method: "DELETE",
            url: `/pipelines/${testUserId}`,
        });

        expect(response.statusCode).toBe(StatusCodes.OK);
        expect(response.json()).toEqual({
            message: `Pipeline for user ${testUserId} deleted`,
            status: "OK",
        });

        const dbPipeline = await server.DBClient.pipelines.findOne({ userId: testUserId });
        expect(dbPipeline).toBeNull();
    });

    it("should return 404 when deleting non-existent pipeline", async () => {
        const response = await server.app.inject({
            method: "DELETE",
            url: "/pipelines/non-existent-user",
        });

        expect(response.statusCode).toBe(StatusCodes.NOT_FOUND);
    });
});

