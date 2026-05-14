import { randomUUID } from "crypto";
import type { User, UserDocument } from "../../users/user.model";
import { ADMIN_TEST_PASSWORD } from "./admin-router-test.consts";

export const buildAdminTestUser = (role: User["role"], email: string): User => ({
    id: randomUUID(),
    firstName: role === "admin" ? "Ada" : "Regular",
    lastName: "User",
    email,
    role,
    password: ADMIN_TEST_PASSWORD,
    birthDate: new Date("1990-01-01"),
    achievements: [],
    technologies: [],
    interests: [],
    knownSkills: [],
    githubSkills: [],
});

export const buildLegacyUserDocument = (email: string): UserDocument => ({
    _id: randomUUID(),
    firstName: "Legacy",
    lastName: "User",
    email,
    password: ADMIN_TEST_PASSWORD,
    birthDate: new Date("1990-01-01"),
    achievements: [],
    technologies: [],
    interests: [],
    knownSkills: [],
    githubSkills: [],
});
