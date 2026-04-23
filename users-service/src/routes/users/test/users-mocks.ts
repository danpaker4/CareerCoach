import type { User } from "../user.model";
import { v4 as uuidv4 } from "uuid";

export const mockUser: User = {
    id: uuidv4(),
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
    port: 0,
    mongoConfig: {
        mongoConnectionString: "mongodb://localhost:27017",
        mongoKeyPath: undefined,
    },
};

