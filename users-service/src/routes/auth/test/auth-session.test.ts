import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { StatusCodes } from "http-status-codes";
import { randomUUID } from "crypto";
import { Server, type ServerConfig } from "../../../server";
import { toUserDocument } from "../../users/user.utils";
import { authHeadersForUser, dropLegacyUsernameIndex } from "../../users/test/users-test-utils";
import { testServerConfig } from "../../users/test/users-mocks";
import {
    AUTH_SESSION_ADMIN_EMAIL,
    AUTH_SESSION_ADMIN_PASSWORD,
    AUTH_SESSION_BOOTSTRAP_EMAIL,
} from "./auth-session-test.consts";
import { buildAuthSessionAdminUser, getRefreshCookieHeader } from "./auth-session-test.utils";

describe("Auth sessions", () => {
    const config: ServerConfig = testServerConfig;
    const server = new Server(config);

    beforeAll(async () => {
        authHeadersForUser({
            id: randomUUID(),
            email: AUTH_SESSION_BOOTSTRAP_EMAIL,
        });
        await server.start();
        await dropLegacyUsernameIndex(server.DBClient.users);
    });

    afterAll(async () => {
        await server.stop();
    });

    afterEach(async () => {
        await server.DBClient.users.deleteMany({ email: AUTH_SESSION_ADMIN_EMAIL });
    });

    it("includes role in login and refresh responses", async () => {
        const adminUser = await buildAuthSessionAdminUser();
        await server.DBClient.users.insertOne(toUserDocument(adminUser));

        const loginResponse = await server.app.inject({
            method: "POST",
            url: "/api/auth/login",
            payload: {
                email: adminUser.email,
                password: AUTH_SESSION_ADMIN_PASSWORD,
            },
        });

        expect(loginResponse.statusCode).toBe(StatusCodes.OK);
        expect(loginResponse.json().user.role).toBe("admin");

        const refreshCookieHeader = getRefreshCookieHeader(loginResponse.headers["set-cookie"]);
        expect(refreshCookieHeader).not.toBe("");

        const refreshResponse = await server.app.inject({
            method: "GET",
            url: "/api/auth/refresh",
            headers: {
                cookie: refreshCookieHeader,
            },
        });

        expect(refreshResponse.statusCode).toBe(StatusCodes.OK);
        expect(refreshResponse.json().user.role).toBe("admin");
    });
});
