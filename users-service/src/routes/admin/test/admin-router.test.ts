import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { StatusCodes } from "http-status-codes";
import { Server, type ServerConfig } from "../../../server";
import { toUserDocument } from "../../users/user.utils";
import { authHeadersForUser, dropLegacyUsernameIndex } from "../../users/test/users-test-utils";
import { testServerConfig } from "../../users/test/users-mocks";
import { ADMIN_TEST_EMAILS } from "./admin-router-test.consts";
import { buildAdminTestUser, buildLegacyUserDocument } from "./admin-router-test.utils";

describe("Admin Router", () => {
    const config: ServerConfig = testServerConfig;
    const server = new Server(config);
    const adminUser = buildAdminTestUser("admin", ADMIN_TEST_EMAILS.admin);
    const regularUser = buildAdminTestUser("user", ADMIN_TEST_EMAILS.regular);
    const targetUser = buildAdminTestUser("user", ADMIN_TEST_EMAILS.target);
    const existingAdmin = buildAdminTestUser("admin", ADMIN_TEST_EMAILS.existingAdmin);
    const legacyUserDocument = buildLegacyUserDocument(ADMIN_TEST_EMAILS.legacy);

    beforeAll(async () => {
        await server.start();
        await dropLegacyUsernameIndex(server.DBClient.users);
    });

    afterAll(async () => {
        await server.stop();
    });

    afterEach(async () => {
        await server.DBClient.users.deleteMany({
            $or: [
                {
                    email: {
                        $in: [
                            adminUser.email,
                            regularUser.email,
                            targetUser.email,
                            existingAdmin.email,
                            legacyUserDocument.email,
                            "outside-search@example.com",
                        ],
                    },
                },
                { email: /^clamp-user-/ },
                { email: /^default-page-/ },
                { email: /^paged-user-/ },
                { email: /^searchable-/ },
            ],
        });
        await server.DBClient.llmTokenUsage.deleteMany({});
    });

    it("returns 403 for authenticated non-admin users", async () => {
        await server.DBClient.users.insertOne(toUserDocument(regularUser));

        const response = await server.app.inject({
            method: "GET",
            url: "/api/admin/users",
            headers: authHeadersForUser(regularUser),
        });

        expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
        expect(response.json()).toEqual({
            error: "Admin access required",
            errorCode: "ADMIN_REQUIRED",
        });
    });

    it("returns current admin session for admin users", async () => {
        await server.DBClient.users.insertOne(toUserDocument(adminUser));

        const response = await server.app.inject({
            method: "GET",
            url: "/api/admin/session",
            headers: authHeadersForUser(adminUser),
        });

        expect(response.statusCode).toBe(StatusCodes.OK);
        expect(response.json()).toEqual({ adminUserId: adminUser.id });
    });

    it("returns 403 for admin session when authenticated user is not an admin", async () => {
        await server.DBClient.users.insertOne(toUserDocument(regularUser));

        const response = await server.app.inject({
            method: "GET",
            url: "/api/admin/session",
            headers: authHeadersForUser(regularUser),
        });

        expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
        expect(response.json()).toEqual({
            error: "Admin access required",
            errorCode: "ADMIN_REQUIRED",
        });
    });

    it("returns 403 for token usage when authenticated user is not an admin", async () => {
        await server.DBClient.users.insertOne(toUserDocument(regularUser));

        const response = await server.app.inject({
            method: "GET",
            url: "/api/admin/llm-token-usage",
            headers: authHeadersForUser(regularUser),
        });

        expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
        expect(response.json()).toEqual({
            error: "Admin access required",
            errorCode: "ADMIN_REQUIRED",
        });
    });

    it("aggregates llm token usage with a default 30 day range", async () => {
        await server.DBClient.users.insertOne(toUserDocument(adminUser));
        const now = new Date();
        const today = new Date(now.getTime() - 1000);

        await server.DBClient.llmTokenUsage.insertMany([
            {
                createdAt: today,
                sourceService: "chat-service",
                operation: "chat.decision",
                provider: "ollama",
                model: "llama3",
                promptTokens: 10,
                completionTokens: 15,
                totalTokens: 25,
                tokenStatus: "known",
                requestCount: 1,
            },
            {
                createdAt: today,
                sourceService: "job-service",
                operation: "job.enrichment",
                provider: "ollama",
                model: "llama3",
                promptTokens: 20,
                completionTokens: 30,
                totalTokens: 50,
                tokenStatus: "known",
                requestCount: 1,
            },
            {
                createdAt: today,
                sourceService: "chat-service",
                operation: "chat.stage_reply",
                provider: "custom",
                model: "custom",
                promptTokens: 0,
                completionTokens: 0,
                totalTokens: 0,
                tokenStatus: "unknown",
                requestCount: 1,
            },
        ]);

        const response = await server.app.inject({
            method: "GET",
            url: "/api/admin/llm-token-usage",
            headers: authHeadersForUser(adminUser),
        });

        const payload = response.json();

        expect(response.statusCode).toBe(StatusCodes.OK);
        expect(payload.range.days).toBe(30);
        expect(payload.series).toEqual([
            {
                date: today.toISOString().slice(0, 10),
                provider: "custom",
                model: "custom",
                promptTokens: 0,
                completionTokens: 0,
                totalTokens: 0,
                requestCount: 1,
                unknownRequestCount: 1,
                errorCount: 0,
            },
            {
                date: today.toISOString().slice(0, 10),
                provider: "ollama",
                model: "llama3",
                promptTokens: 30,
                completionTokens: 45,
                totalTokens: 75,
                requestCount: 2,
                unknownRequestCount: 0,
                errorCount: 0,
            },
        ]);
        expect(payload.operationBreakdown).toEqual([
            {
                sourceService: "job-service",
                operation: "job.enrichment",
                promptTokens: 20,
                completionTokens: 30,
                totalTokens: 50,
                requestCount: 1,
                unknownRequestCount: 0,
            },
            {
                sourceService: "chat-service",
                operation: "chat.decision",
                promptTokens: 10,
                completionTokens: 15,
                totalTokens: 25,
                requestCount: 1,
                unknownRequestCount: 0,
            },
            {
                sourceService: "chat-service",
                operation: "chat.stage_reply",
                promptTokens: 0,
                completionTokens: 0,
                totalTokens: 0,
                requestCount: 1,
                unknownRequestCount: 1,
            },
        ]);
        expect(payload.operationSeries).toEqual([
            {
                date: today.toISOString().slice(0, 10),
                sourceService: "chat-service",
                operation: "chat.decision",
                promptTokens: 10,
                completionTokens: 15,
                totalTokens: 25,
                requestCount: 1,
                unknownRequestCount: 0,
            },
            {
                date: today.toISOString().slice(0, 10),
                sourceService: "chat-service",
                operation: "chat.stage_reply",
                promptTokens: 0,
                completionTokens: 0,
                totalTokens: 0,
                requestCount: 1,
                unknownRequestCount: 1,
            },
            {
                date: today.toISOString().slice(0, 10),
                sourceService: "job-service",
                operation: "job.enrichment",
                promptTokens: 20,
                completionTokens: 30,
                totalTokens: 50,
                requestCount: 1,
                unknownRequestCount: 0,
            },
        ]);
        expect(payload.userAverageSeries).toEqual([]);
    });

    it("aggregates token usage averages per user and errors per model", async () => {
        await server.DBClient.users.insertOne(toUserDocument(adminUser));
        const now = new Date();
        const today = new Date(now.getTime() - 1000);

        await server.DBClient.llmTokenUsage.insertMany([
            {
                createdAt: today,
                sourceService: "chat-service",
                operation: "chat.decision",
                userId: "user-a",
                provider: "gemini",
                model: "gemini-3.0-flash",
                promptTokens: 40,
                completionTokens: 60,
                totalTokens: 100,
                tokenStatus: "known",
                requestStatus: "success",
                errorCount: 0,
                requestCount: 1,
            },
            {
                createdAt: today,
                sourceService: "chat-service",
                operation: "chat.stage_reply",
                userId: "user-a",
                provider: "gemini",
                model: "gemini-3.0-flash",
                promptTokens: 0,
                completionTokens: 0,
                totalTokens: 0,
                tokenStatus: "unknown",
                requestStatus: "error",
                errorCount: 1,
                requestCount: 1,
            },
            {
                createdAt: today,
                sourceService: "chat-service",
                operation: "chat.job_aware_reply",
                userId: "user-b",
                provider: "openai",
                model: "gpt-4o-mini",
                promptTokens: 25,
                completionTokens: 25,
                totalTokens: 50,
                tokenStatus: "known",
                requestStatus: "success",
                errorCount: 0,
                requestCount: 1,
            },
            {
                createdAt: today,
                sourceService: "chat-service",
                operation: "chat.decision",
                provider: "ollama",
                model: "llama3",
                promptTokens: 1000,
                completionTokens: 1000,
                totalTokens: 2000,
                tokenStatus: "known",
                requestStatus: "success",
                errorCount: 0,
                requestCount: 1,
            },
        ]);

        const response = await server.app.inject({
            method: "GET",
            url: "/api/admin/llm-token-usage",
            headers: authHeadersForUser(adminUser),
        });
        const payload = response.json();

        expect(response.statusCode).toBe(StatusCodes.OK);
        expect(payload.series).toEqual([
            {
                date: today.toISOString().slice(0, 10),
                provider: "gemini",
                model: "gemini-3.0-flash",
                promptTokens: 40,
                completionTokens: 60,
                totalTokens: 100,
                requestCount: 2,
                unknownRequestCount: 1,
                errorCount: 1,
            },
            {
                date: today.toISOString().slice(0, 10),
                provider: "ollama",
                model: "llama3",
                promptTokens: 1000,
                completionTokens: 1000,
                totalTokens: 2000,
                requestCount: 1,
                unknownRequestCount: 0,
                errorCount: 0,
            },
            {
                date: today.toISOString().slice(0, 10),
                provider: "openai",
                model: "gpt-4o-mini",
                promptTokens: 25,
                completionTokens: 25,
                totalTokens: 50,
                requestCount: 1,
                unknownRequestCount: 0,
                errorCount: 0,
            },
        ]);
        expect(payload.userAverageSeries).toEqual([
            {
                date: today.toISOString().slice(0, 10),
                totalTokens: 150,
                requestCount: 3,
                activeUserCount: 2,
                averageTokensPerUser: 75,
                averageRequestsPerUser: 1.5,
            },
        ]);
    });

    it("filters token usage by requested day range", async () => {
        await server.DBClient.users.insertOne(toUserDocument(adminUser));
        const now = new Date();
        const today = new Date(now.getTime() - 1000);
        const olderThanRange = new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000);

        await server.DBClient.llmTokenUsage.insertMany([
            {
                createdAt: olderThanRange,
                sourceService: "chat-service",
                operation: "chat.decision",
                provider: "gemini",
                model: "gemini-3.0-flash",
                promptTokens: 100,
                completionTokens: 100,
                totalTokens: 200,
                tokenStatus: "known",
                requestCount: 1,
            },
            {
                createdAt: today,
                sourceService: "chat-service",
                operation: "chat.decision",
                provider: "openai",
                model: "gpt-4o-mini",
                promptTokens: 7,
                completionTokens: 9,
                totalTokens: 16,
                tokenStatus: "known",
                requestCount: 1,
            },
        ]);

        const response = await server.app.inject({
            method: "GET",
            url: "/api/admin/llm-token-usage?days=1",
            headers: authHeadersForUser(adminUser),
        });

        expect(response.statusCode).toBe(StatusCodes.OK);
        expect(response.json()).toMatchObject({
            series: [
                {
                    date: today.toISOString().slice(0, 10),
                    provider: "openai",
                    model: "gpt-4o-mini",
                    promptTokens: 7,
                    completionTokens: 9,
                    totalTokens: 16,
                    requestCount: 1,
                    unknownRequestCount: 0,
                },
            ],
            operationBreakdown: [
                {
                    sourceService: "chat-service",
                    operation: "chat.decision",
                    promptTokens: 7,
                    completionTokens: 9,
                    totalTokens: 16,
                    requestCount: 1,
                    unknownRequestCount: 0,
                },
            ],
            operationSeries: [
                {
                    date: today.toISOString().slice(0, 10),
                    sourceService: "chat-service",
                    operation: "chat.decision",
                    promptTokens: 7,
                    completionTokens: 9,
                    totalTokens: 16,
                    requestCount: 1,
                    unknownRequestCount: 0,
                },
            ],
        });
    });

    it("returns searched users with default pagination metadata", async () => {
        const defaultPageUsers = Array.from({ length: 3 }, (_, index) =>
            buildAdminTestUser("user", `default-page-${index}@example.com`)
        );
        await server.DBClient.users.insertMany([
            toUserDocument(adminUser),
            ...defaultPageUsers.map(toUserDocument),
        ]);

        const response = await server.app.inject({
            method: "GET",
            url: "/api/admin/users?query=default-page",
            headers: authHeadersForUser(adminUser),
        });
        const expectedUsers = [...defaultPageUsers]
            .sort((left, right) => left.email.localeCompare(right.email))
            .map((user) => ({
                id: user.id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                role: "user",
            }));

        expect(response.statusCode).toBe(StatusCodes.OK);
        expect(response.json()).toEqual({
            users: expectedUsers,
            pagination: {
                page: 1,
                pageSize: 25,
                total: 3,
                totalPages: 1,
                hasNextPage: false,
                hasPreviousPage: false,
            },
        });
    });

    it("returns page 2 users with stable email sorting", async () => {
        const pagedUsers = Array.from({ length: 30 }, (_, index) =>
            buildAdminTestUser("user", `paged-user-${String(index).padStart(2, "0")}@example.com`)
        );
        await server.DBClient.users.insertMany([
            toUserDocument(adminUser),
            ...pagedUsers.map(toUserDocument),
        ]);
        const expectedEmails = pagedUsers
            .map((user) => user.email)
            .sort((left, right) => left.localeCompare(right))
            .slice(10, 20);

        const response = await server.app.inject({
            method: "GET",
            url: "/api/admin/users?query=paged-user-&page=2&pageSize=10",
            headers: authHeadersForUser(adminUser),
        });

        expect(response.statusCode).toBe(StatusCodes.OK);
        expect(response.json().users.map((user: { email: string }) => user.email)).toEqual(expectedEmails);
        expect(response.json().pagination).toEqual({
            page: 2,
            pageSize: 10,
            total: 30,
            totalPages: 3,
            hasNextPage: true,
            hasPreviousPage: true,
        });
    });

    it("combines user search with pagination", async () => {
        const matchingUsers = Array.from({ length: 4 }, (_, index) => ({
            ...buildAdminTestUser("user", `searchable-${index}@example.com`),
            firstName: "Searchable",
            lastName: `User ${index}`,
        }));
        const outsideSearchUser = buildAdminTestUser("user", "outside-search@example.com");
        await server.DBClient.users.insertMany([
            toUserDocument(adminUser),
            toUserDocument(outsideSearchUser),
            ...matchingUsers.map(toUserDocument),
        ]);

        const response = await server.app.inject({
            method: "GET",
            url: "/api/admin/users?query=Searchable&page=2&pageSize=2",
            headers: authHeadersForUser(adminUser),
        });

        expect(response.statusCode).toBe(StatusCodes.OK);
        expect(response.json().users).toEqual(
            [...matchingUsers]
                .sort((left, right) => left.email.localeCompare(right.email))
                .slice(2, 4)
                .map((user) => ({
                    id: user.id,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    email: user.email,
                    role: "user",
                }))
        );
        expect(response.json().pagination).toEqual({
            page: 2,
            pageSize: 2,
            total: 4,
            totalPages: 2,
            hasNextPage: false,
            hasPreviousPage: true,
        });
    });

    it("rejects invalid user pagination parameters", async () => {
        await server.DBClient.users.insertOne(toUserDocument(adminUser));

        const pageResponse = await server.app.inject({
            method: "GET",
            url: "/api/admin/users?page=0",
            headers: authHeadersForUser(adminUser),
        });
        const pageSizeResponse = await server.app.inject({
            method: "GET",
            url: "/api/admin/users?pageSize=101",
            headers: authHeadersForUser(adminUser),
        });

        expect(pageResponse.statusCode).toBe(StatusCodes.BAD_REQUEST);
        expect(pageSizeResponse.statusCode).toBe(StatusCodes.BAD_REQUEST);
    });

    it("searches users and defaults legacy missing roles to user", async () => {
        await server.DBClient.users.insertMany([
            toUserDocument(adminUser),
            legacyUserDocument,
        ]);

        const response = await server.app.inject({
            method: "GET",
            url: "/api/admin/users?query=legacy",
            headers: authHeadersForUser(adminUser),
        });

        expect(response.statusCode).toBe(StatusCodes.OK);
        expect(response.json()).toEqual({
            users: [
                {
                    id: legacyUserDocument._id,
                    firstName: legacyUserDocument.firstName,
                    lastName: legacyUserDocument.lastName,
                    email: legacyUserDocument.email,
                    role: "user",
                },
            ],
            pagination: {
                page: 1,
                pageSize: 25,
                total: 1,
                totalPages: 1,
                hasNextPage: false,
                hasPreviousPage: false,
            },
        });
    });

    it("clamps user pages above the result range", async () => {
        const clampUsers = Array.from({ length: 2 }, (_, index) =>
            buildAdminTestUser("user", `clamp-user-${index}@example.com`)
        );
        await server.DBClient.users.insertMany([
            toUserDocument(adminUser),
            ...clampUsers.map(toUserDocument),
        ]);
        const expectedUser = [...clampUsers].sort((left, right) => left.email.localeCompare(right.email))[1];

        const response = await server.app.inject({
            method: "GET",
            url: "/api/admin/users?query=clamp-user-&page=5&pageSize=1",
            headers: authHeadersForUser(adminUser),
        });

        expect(response.statusCode).toBe(StatusCodes.OK);
        expect(response.json().pagination).toEqual({
            page: 2,
            pageSize: 1,
            total: 2,
            totalPages: 2,
            hasNextPage: false,
            hasPreviousPage: true,
        });
        expect(response.json().users).toEqual([
            {
                id: expectedUser.id,
                firstName: expectedUser.firstName,
                lastName: expectedUser.lastName,
                email: expectedUser.email,
                role: "user",
            },
        ]);
    });

    it("promotes an existing user by email case-insensitively", async () => {
        await server.DBClient.users.insertMany([
            toUserDocument(adminUser),
            toUserDocument(targetUser),
        ]);

        const response = await server.app.inject({
            method: "POST",
            url: "/api/admin/admins",
            headers: authHeadersForUser(adminUser),
            payload: { email: targetUser.email.toUpperCase() },
        });

        expect(response.statusCode).toBe(StatusCodes.OK);
        expect(response.json().user).toMatchObject({
            id: targetUser.id,
            email: targetUser.email,
            role: "admin",
        });

        const promotedUser = await server.DBClient.users.findOne({ _id: targetUser.id });
        expect(promotedUser?.role).toBe("admin");
    });

    it("returns 404 when promoting a missing user", async () => {
        await server.DBClient.users.insertOne(toUserDocument(adminUser));

        const response = await server.app.inject({
            method: "POST",
            url: "/api/admin/admins",
            headers: authHeadersForUser(adminUser),
            payload: { email: ADMIN_TEST_EMAILS.missing },
        });

        expect(response.statusCode).toBe(StatusCodes.NOT_FOUND);
        expect(response.json()).toEqual({
            error: "User not found",
            errorCode: "USER_NOT_FOUND",
        });
    });

    it("promotes existing admins idempotently", async () => {
        await server.DBClient.users.insertMany([
            toUserDocument(adminUser),
            toUserDocument(existingAdmin),
        ]);

        const response = await server.app.inject({
            method: "POST",
            url: "/api/admin/admins",
            headers: authHeadersForUser(adminUser),
            payload: { email: existingAdmin.email },
        });

        expect(response.statusCode).toBe(StatusCodes.OK);
        expect(response.json().user).toMatchObject({
            id: existingAdmin.id,
            email: existingAdmin.email,
            role: "admin",
        });
    });

    it("demotes an existing admin", async () => {
        await server.DBClient.users.insertMany([
            toUserDocument(adminUser),
            toUserDocument(existingAdmin),
        ]);

        const response = await server.app.inject({
            method: "DELETE",
            url: `/api/admin/admins/${existingAdmin.id}`,
            headers: authHeadersForUser(adminUser),
        });

        expect(response.statusCode).toBe(StatusCodes.OK);
        expect(response.json().user).toMatchObject({
            id: existingAdmin.id,
            role: "user",
        });

        const demotedUser = await server.DBClient.users.findOne({ _id: existingAdmin.id });
        expect(demotedUser?.role).toBe("user");
    });

    it("does not allow admins to demote themselves", async () => {
        await server.DBClient.users.insertOne(toUserDocument(adminUser));

        const response = await server.app.inject({
            method: "DELETE",
            url: `/api/admin/admins/${adminUser.id}`,
            headers: authHeadersForUser(adminUser),
        });

        expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
        expect(response.json()).toEqual({
            error: "Admins cannot demote themselves",
            errorCode: "SELF_DEMOTION_FORBIDDEN",
        });
    });

    it("deletes an existing regular user", async () => {
        await server.DBClient.users.insertMany([
            toUserDocument(adminUser),
            toUserDocument(targetUser),
        ]);

        const response = await server.app.inject({
            method: "DELETE",
            url: `/api/admin/users/${targetUser.id}`,
            headers: authHeadersForUser(adminUser),
        });

        expect(response.statusCode).toBe(StatusCodes.OK);
        expect(response.json()).toEqual({ deletedUserId: targetUser.id });

        const deletedUser = await server.DBClient.users.findOne({ _id: targetUser.id });
        expect(deletedUser).toBeNull();
    });

    it("does not allow admins to delete themselves", async () => {
        await server.DBClient.users.insertOne(toUserDocument(adminUser));

        const response = await server.app.inject({
            method: "DELETE",
            url: `/api/admin/users/${adminUser.id}`,
            headers: authHeadersForUser(adminUser),
        });

        expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
        expect(response.json()).toEqual({
            error: "Admins cannot delete themselves",
            errorCode: "SELF_DELETE_FORBIDDEN",
        });
    });
});
