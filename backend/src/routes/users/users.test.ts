import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { StatusCodes } from "http-status-codes";
import { Server, type ServerConfig } from "../../server";

describe("Users Router", () => {
    const config: ServerConfig = { port: 4322, mongoConfig: {
        mongoConnectionString: "mongodb://localhost:27017",
        mongoKeyPath: undefined
    } };

    const server = new Server(config);

    beforeAll(async () => {
        await server.start();
    });

    afterAll(async () => {
        await server.stop();
    });

    describe("PATCH /users/:userId", () => {
        it("should return 200 OK with user message", async () => {
            const response = await server.app.inject({
                method: "PATCH",
                url: "/users/123",
            });

            expect(response.statusCode).toBe(StatusCodes.OK);
            expect(response.json()).toEqual({
                message: "User 123 updated",
                status: "OK",
            });
        });

        it("should handle different userId values", async () => {
            const response = await server.app.inject({
                method: "PATCH",
                url: "/users/abc-456",
            });

            expect(response.statusCode).toBe(StatusCodes.OK);
            expect(response.json()).toEqual({
                message: "User abc-456 updated",
                status: "OK",
            });
        });
    });
});
