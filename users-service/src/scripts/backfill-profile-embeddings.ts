import dotenv from "dotenv";
import { MongoClient } from "mongodb";
import { getProfileEmbeddingConfig } from "../routes/users/user-embedding.config";
import { buildUserProfileText, regenerateProfileEmbedding } from "../routes/users/user-embedding.service";
import type { UserDocument } from "../routes/users/user.model";
import { toUser } from "../routes/users/user.utils";

dotenv.config();

const runBackfill = async (): Promise<void> => {
    const config = getProfileEmbeddingConfig();
    if (!config.GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY is required to backfill profile embeddings");
    }

    const mongoConnectionString = process.env.MONGO_CONNECTION_STRING;
    if (!mongoConnectionString) {
        throw new Error("MONGO_CONNECTION_STRING is required");
    }

    const client = new MongoClient(mongoConnectionString);
    await client.connect();
    try {
        const usersCollection = client.db().collection<UserDocument>("users");
        const users = await usersCollection.find({}).toArray();
        const eligibleUsers = users.filter((userDocument) => {
            const user = toUser(userDocument);
            const hasProfileText = buildUserProfileText(user).trim().length > 0;
            const needsEmbedding =
                user.profileEmbedding.length !== config.PROFILE_EMBEDDING_DIMENSIONS ||
                user.profileEmbeddingModel !== config.PROFILE_EMBEDDING_MODEL ||
                user.profileEmbeddingStatus !== "ready";
            return hasProfileText && needsEmbedding;
        });

        const results = await eligibleUsers.reduce<Promise<boolean[]>>(async (resultsPromise, userDocument) => {
            const resultsSoFar = await resultsPromise;
            const succeeded = await regenerateProfileEmbedding(usersCollection, userDocument._id)
                .then(() => true)
                .catch((error: unknown) => {
                    console.error(`Profile embedding backfill failed for user ${userDocument._id}`, error);
                    return false;
                });
            return [...resultsSoFar, succeeded];
        }, Promise.resolve([]));
        const succeeded = results.filter(Boolean).length;
        console.log(JSON.stringify({ eligible: eligibleUsers.length, succeeded, failed: results.length - succeeded }));
    } finally {
        await client.close();
    }
};

runBackfill().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
});
