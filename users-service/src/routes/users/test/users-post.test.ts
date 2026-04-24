import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { StatusCodes } from "http-status-codes";
import { Server, type ServerConfig } from "../../../server";
import { mockUser, mockUserData, mockUserWithoutJob, testServerConfig } from "./users-mocks";
import { authHeadersForUser, dropLegacyUsernameIndex } from "./users-test-utils";

describe("Users Router - POST /users", () => {
    const config: ServerConfig = testServerConfig;
    const server = new Server(config);

    beforeAll(async () => {
        await server.start();
        await dropLegacyUsernameIndex(server.DBClient.users);
    });

    afterAll(async () => {
        await server.stop();
    });

    afterEach(async () => {
        await server.DBClient.users.deleteMany({
            email: { $in: [mockUserData.email, mockUserWithoutJob.email, "different.email@example.com"] },
        });
    });

    describe("POST /users", () => {
        it("should create a new user with all fields", async () => {
            const response = await server.app.inject({
                method: "POST",
                url: "/users",
                headers: authHeadersForUser(mockUser),
                payload: mockUserData,
            });

            expect(response.statusCode).toBe(StatusCodes.CREATED);
            const createdUser = response.json();
            expect(createdUser.id).toBeDefined();
            expect(createdUser.firstName).toBe(mockUserData.firstName);
            expect(createdUser.lastName).toBe(mockUserData.lastName);
            expect(createdUser.email).toBe(mockUserData.email);
            expect(createdUser.currentJob).toBe(mockUserData.currentJob);
            expect(createdUser.birthDate).toBeDefined();

            const dbUser = await server.DBClient.users.findOne({ email: mockUserData.email });
            expect(dbUser).toBeDefined();
            expect(dbUser?.id).toBe(createdUser.id);
        });

        it("should create a new user without optional currentJob field", async () => {
            const response = await server.app.inject({
                method: "POST",
                url: "/users",
                headers: authHeadersForUser(mockUser),
                payload: mockUserWithoutJob,
            });

            expect(response.statusCode).toBe(StatusCodes.CREATED);
            const createdUser = response.json();
            expect(createdUser.id).toBeDefined();
            expect(createdUser.firstName).toBe(mockUserWithoutJob.firstName);
            expect(createdUser.lastName).toBe(mockUserWithoutJob.lastName);
            expect(createdUser.email).toBe(mockUserWithoutJob.email);
            expect(createdUser.currentJob).toBeUndefined();

            const dbUser = await server.DBClient.users.findOne({ email: mockUserWithoutJob.email });
            expect(dbUser).toBeDefined();
            expect(dbUser?.currentJob).toBeUndefined();
        });

        it("should generate unique ID for each user", async () => {
            const response1 = await server.app.inject({
                method: "POST",
                url: "/users",
                headers: authHeadersForUser(mockUser),
                payload: mockUserData,
            });

            const response2 = await server.app.inject({
                method: "POST",
                url: "/users",
                headers: authHeadersForUser(mockUser),
                payload: {
                    ...mockUserData,
                    email: "different.email@example.com",
                },
            });

            expect(response1.statusCode).toBe(StatusCodes.CREATED);
            expect(response2.statusCode).toBe(StatusCodes.CREATED);

            const user1 = response1.json();
            const user2 = response2.json();

            expect(user1.id).toBeDefined();
            expect(user2.id).toBeDefined();
            expect(user1.id).not.toBe(user2.id);
        });

        it("should save user to database", async () => {
            const response = await server.app.inject({
                method: "POST",
                url: "/users",
                headers: authHeadersForUser(mockUser),
                payload: mockUserData,
            });

            expect(response.statusCode).toBe(StatusCodes.CREATED);
            const createdUser = response.json();

            const dbUser = await server.DBClient.users.findOne({ id: createdUser.id });
            expect(dbUser).toBeDefined();
            expect(dbUser?.firstName).toBe(mockUserData.firstName);
            expect(dbUser?.lastName).toBe(mockUserData.lastName);
            expect(dbUser?.email).toBe(mockUserData.email);
        });
    });
});

