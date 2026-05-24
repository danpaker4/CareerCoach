import type { Db } from "mongodb";
import type { UserEmbeddingCache } from "./user-embedding.cache";

const RECONNECT_DELAY_MS = 5_000;

export const startUserChangeStream = (db: Db, cache: UserEmbeddingCache): void => {
    const usersCollection = db.collection("users");

    const pipeline = [
        {
            $match: {
                operationType: "update",
                "updateDescription.updatedFields.profileEmbedding": { $exists: true },
            },
        },
    ];

    const changeStream = usersCollection.watch(pipeline);

    changeStream.on("change", (change) => {
        if (change.operationType === "update" && change.documentKey) {
            const userId = String(change.documentKey._id);
            cache.invalidate(userId);
            console.log(`[ChangeStream] Invalidated embedding cache for user ${userId}`);
        }
    });

    changeStream.on("error", (err) => {
        console.error("[ChangeStream] Error on users collection:", err);
        setTimeout(() => startUserChangeStream(db, cache), RECONNECT_DELAY_MS);
    });

    console.log("[ChangeStream] Watching users collection for embedding updates");
};
