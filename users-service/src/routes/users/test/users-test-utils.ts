import type { Collection } from "mongodb";
import { generateAccessToken } from "../../auth/auth-tokens.service";
import { ACCESS_TOKEN_COOKIE } from "../../auth/auth.utils";
import type { User } from "../user.model";

const TEST_JWT_SECRET = "test-secret";

export const authHeadersForUser = (user: Pick<User, "id" | "email">): Record<string, string> => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || TEST_JWT_SECRET;
    const accessToken = generateAccessToken({ userId: user.id, email: user.email });
    return {
        cookie: `${ACCESS_TOKEN_COOKIE}=${accessToken}`,
    };
};

export const dropLegacyUsernameIndex = async (usersCollection: Collection<User>): Promise<void> => {
    await usersCollection.dropIndex("username_1").catch(() => undefined);
};
