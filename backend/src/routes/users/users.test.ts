import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { StatusCodes } from "http-status-codes";
import { Server, type ServerConfig } from "../../server";
import type { User } from "./user.model";

describe("Users Router", () => {
    const config: ServerConfig = {
        port: 4322,
        mongoConfig: {
            mongoConnectionString: "mongodb://localhost:27017",
            mongoKeyPath: undefined,
        },
    };

    const server = new Server(config);
    const testUserId = "test-user-123";
    const newUserId = "new-user-456";

    beforeAll(async () => {
        await server.start();
    });

    afterAll(async () => {
        await server.DBClient.users.deleteMany({ id: { $in: [testUserId, newUserId] } });
        await server.stop();
    });

    beforeEach(async () => {
        const testUser: User = {
            id: testUserId,
            firstName: "John",
            lastName: "Doe",
            email: "john.doe@example.com",
            password: "hashedpassword",
            birthDate: new Date("1990-01-01"),
            currentJob: "Developer",
        };

        await server.DBClient.users.insertOne(testUser);
    });

    afterEach(async () => {
        await server.DBClient.users.deleteMany({ id: { $in: [testUserId, newUserId] } });
    });

    describe("PATCH /users/:userId", () => {
        it("should update user in database", async () => {
            const userBefore = await server.DBClient.users.findOne({ id: testUserId });
            expect(userBefore).toBeDefined();
            expect(userBefore?.firstName).toBe("John");

            const response = await server.app.inject({
                method: "PATCH",
                url: `/users/${testUserId}`,
            });

            expect(response.statusCode).toBe(StatusCodes.OK);
            expect(response.json()).toEqual({
                message: `User ${testUserId} updated`,
                status: "OK",
            });

            const userAfter = await server.DBClient.users.findOne({ id: testUserId });
            expect(userAfter).toBeDefined();
            expect(userAfter?.firstName).toBe("John");
            expect(userAfter?.lastName).toBe("Doe");
        });

        it("should create user if it doesn't exist (upsert)", async () => {
            await server.DBClient.users.deleteOne({ id: newUserId });

            const userBefore = await server.DBClient.users.findOne({ id: newUserId });
            expect(userBefore).toBeNull();

            const response = await server.app.inject({
                method: "PATCH",
                url: `/users/${newUserId}`,
            });

            expect(response.statusCode).toBe(StatusCodes.OK);

            const userAfter = await server.DBClient.users.findOne({ id: newUserId });
            expect(userAfter).toBeDefined();
            expect(userAfter?.firstName).toBe("John");
            expect(userAfter?.lastName).toBe("Doe");
            expect(userAfter?.id).toBe(newUserId);
        });
    });
});
