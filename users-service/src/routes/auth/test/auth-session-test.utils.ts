import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import type { User } from "../../users/user.model";
import { AUTH_SESSION_ADMIN_EMAIL, AUTH_SESSION_ADMIN_PASSWORD } from "./auth-session-test.consts";

export const buildAuthSessionAdminUser = async (): Promise<User> => ({
    id: randomUUID(),
    firstName: "Admin",
    lastName: "Session",
    email: AUTH_SESSION_ADMIN_EMAIL,
    role: "admin",
    password: await bcrypt.hash(AUTH_SESSION_ADMIN_PASSWORD, 10),
    birthDate: new Date("1990-01-01"),
    achievements: [],
    technologies: [],
    interests: [],
    knownSkills: [],
    roleExperience: [],
    githubSkills: [],
});

export const getRefreshCookieHeader = (setCookieHeader: string | string[] | undefined): string => {
    const headers = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
    return headers
        .filter((header): header is string => typeof header === "string")
        .find((header) => header.startsWith("refreshToken="))
        ?.split(";")[0] ?? "";
};
