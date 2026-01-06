import type { User } from "../user.model";

export const mockUser: User = {
    id: "test-user-123",
    firstName: "John",
    lastName: "Doe",
    email: "john.doe@example.com",
    password: "hashedpassword",
    birthDate: new Date("1990-01-01"),
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
    port: 4322,
    mongoConfig: {
        mongoConnectionString: "mongodb://localhost:27017",
        mongoKeyPath: undefined,
    },
};

