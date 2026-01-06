import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { StatusCodes } from "http-status-codes";
import { Server, type ServerConfig } from "../../../server";
import { mockUser, testServerConfig } from "./users-mocks";

describe("Users Router - GET /users/:userId", () => {
    const config: ServerConfig = testServerConfig;
    const server = new Server(config);
    const testUserId = mockUser.id;
    const nonExistentUserId = "non-existent-user-999";

    beforeAll(async () => {
        await server.start();
    });

    afterAll(async () => {
        await server.DBClient.users.deleteMany({ id: testUserId });
        await server.stop();
    });

    beforeEach(async () => {
        await server.DBClient.users.insertOne(mockUser);
    });

    afterEach(async () => {
        await server.DBClient.users.deleteMany({ id: testUserId });
    });

    describe("GET /users/:userId", () => {
        it("should return user when user exists", async () => {
            const response = await server.app.inject({
                method: "GET",
                url: `/users/${testUserId}`,
            });

            expect(response.statusCode).toBe(StatusCodes.OK);
            const user = response.json();
            expect(user.id).toBe(testUserId);
            expect(user.firstName).toBe(mockUser.firstName);
            expect(user.lastName).toBe(mockUser.lastName);
            expect(user.email).toBe(mockUser.email);
            expect(user.currentJob).toBe(mockUser.currentJob);
        });

        it("should return 404 when user does not exist", async () => {
            const response = await server.app.inject({
                method: "GET",
                url: `/users/${nonExistentUserId}`,
            });

            expect(response.statusCode).toBe(StatusCodes.NOT_FOUND);
            expect(response.json()).toEqual({
                error: "User not found",
            });
        });

        it("should return user from database", async () => {
            const dbUser = await server.DBClient.users.findOne({ id: testUserId });
            expect(dbUser).toBeDefined();

            const response = await server.app.inject({
                method: "GET",
                url: `/users/${testUserId}`,
            });

            expect(response.statusCode).toBe(StatusCodes.OK);
            const responseUser = response.json();
            expect(responseUser.id).toBe(dbUser?.id);
            expect(responseUser.firstName).toBe(dbUser?.firstName);
            expect(responseUser.lastName).toBe(dbUser?.lastName);
        });
    });
});

