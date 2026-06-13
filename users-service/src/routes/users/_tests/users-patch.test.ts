import { randomUUID } from "crypto";
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { StatusCodes } from "http-status-codes";
import { Server, type ServerConfig } from "../../../server";
import { mockUser, testServerConfig } from "./users-mocks";
import { authHeadersForUser, dropLegacyUsernameIndex } from "./users-test-utils";
import { toUserDocument } from "../user.utils";

describe("Users Router - PATCH /users/:userId", () => {
    const config: ServerConfig = testServerConfig;
    const server = new Server(config);
    const testUserId = mockUser.id;
    const newUserId = randomUUID();

    beforeAll(async () => {
        await server.start();
        await dropLegacyUsernameIndex(server.DBClient.users);
    });

    afterAll(async () => {
        await server.DBClient.users.deleteMany({ _id: { $in: [testUserId, newUserId] } });
        await server.stop();
    });

    beforeEach(async () => {
        await server.DBClient.users.insertOne(toUserDocument(mockUser));
    });

    afterEach(async () => {
        await server.DBClient.users.deleteMany({ _id: { $in: [testUserId, newUserId] } });
    });

    describe("PATCH /users/:userId", () => {
        it("should update user in database", async () => {
            const userBefore = await server.DBClient.users.findOne({ _id: testUserId });
            expect(userBefore).toBeDefined();
            expect(userBefore?.firstName).toBe("John");

            const response = await server.app.inject({
                method: "PATCH",
                url: `/users/${testUserId}`,
                headers: authHeadersForUser(mockUser),
                payload: { firstName: "UpdatedName" },
            });

            expect(response.statusCode).toBe(StatusCodes.OK);
            expect(response.json()).toEqual({
                message: `User ${testUserId} updated`,
                status: "OK",
            });

            const userAfter = await server.DBClient.users.findOne({ _id: testUserId });
            expect(userAfter).toBeDefined();
            expect(userAfter?.firstName).toBe("UpdatedName");
            expect(userAfter?.lastName).toBe("Doe");
        });

        it("should create user if it doesn't exist (upsert)", async () => {
            await server.DBClient.users.deleteOne({ _id: newUserId });

            const userBefore = await server.DBClient.users.findOne({ _id: newUserId });
            expect(userBefore).toBeNull();

            const response = await server.app.inject({
                method: "PATCH",
                url: `/users/${newUserId}`,
                headers: authHeadersForUser(mockUser),
                payload: { firstName: "NewUser", lastName: "LastName" },
            });

            expect(response.statusCode).toBe(StatusCodes.OK);

            const userAfter = await server.DBClient.users.findOne({ _id: newUserId });
            expect(userAfter).toBeDefined();
            expect(userAfter?.firstName).toBe("NewUser");
            expect(userAfter?.lastName).toBe("LastName");
            expect(userAfter?._id).toBe(newUserId);
        });
    });
});
