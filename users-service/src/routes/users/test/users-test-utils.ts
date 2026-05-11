import type { Collection } from "mongodb";
import { generateAccessToken } from "../../auth/auth-tokens.service";
import type { User, UserDocument } from "../user.model";

const TEST_JWT_ACCESS_SECRET = "test-access-secret";
const TEST_JWT_REFRESH_SECRET = "test-refresh-secret";

export const authHeadersForUser = (user: Pick<User, "id" | "email">): Record<string, string> => {
    process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || TEST_JWT_ACCESS_SECRET;
    process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || TEST_JWT_REFRESH_SECRET;
    process.env.REFRESH_TOKEN_COOKIE = process.env.REFRESH_TOKEN_COOKIE || "refreshToken";
    process.env.JWT_ACCESS_EXPIRES_IN_SECONDS = process.env.JWT_ACCESS_EXPIRES_IN_SECONDS || "60";
    process.env.JWT_REFRESH_EXPIRES_IN_SECONDS = process.env.JWT_REFRESH_EXPIRES_IN_SECONDS || "604800";
    const accessToken = generateAccessToken({ userId: user.id, email: user.email });
    return {
        authorization: `Bearer ${accessToken}`,
    };
};

export const dropLegacyUsernameIndex = async (usersCollection: Collection<UserDocument>): Promise<void> => {
    await usersCollection.dropIndex("username_1").catch(() => undefined);
};
