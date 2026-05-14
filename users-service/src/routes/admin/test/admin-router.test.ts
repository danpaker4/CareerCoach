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
            email: {
                $in: [
                    adminUser.email,
                    regularUser.email,
                    targetUser.email,
                    existingAdmin.email,
                    legacyUserDocument.email,
                ],
            },
        });
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
        expect(response.json()).toEqual([
            {
                id: legacyUserDocument._id,
                firstName: legacyUserDocument.firstName,
                lastName: legacyUserDocument.lastName,
                email: legacyUserDocument.email,
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
