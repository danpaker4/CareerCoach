import { randomUUID } from "crypto";
import type { User } from "../user.model";

export const mockUser: User = {
    id: randomUUID(),
    firstName: "John",
    lastName: "Doe",
    email: "john.doe@example.com",
    role: "user",
    password: "hashedpassword",
    birthDate: new Date("1990-01-01"),
    achievements: [],
    technologies: [],
    interests: [],
    knownSkills: [],
    roleExperience: [],
    githubSkills: [],
    currentJob: "Developer",
};

export const mockUserData = {
    firstName: "Jane",
    lastName: "Smith",
    email: "jane.smith@example.com",
    password: "hashedpassword123",
    birthDate: new Date("1995-05-15"),
    currentJob: "Designer",
};

export const mockUserWithoutJob = {
    firstName: "Bob",
    lastName: "Johnson",
    email: "bob.johnson@example.com",
    password: "hashedpassword456",
    birthDate: new Date("1988-03-20"),
};

export const testServerConfig = {
    port: 0,
    host: "127.0.0.1",
    mongoConfig: {
        mongoConnectionString: "mongodb://localhost:27017",
        mongoKeyPath: undefined,
    },
};

