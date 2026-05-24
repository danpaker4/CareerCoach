import type { Db } from "mongodb";
import type { UserEmbeddingCache } from "./user-embedding.cache";

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
        }
    });

    changeStream.on("error", (err) => {
        console.error("User change stream error:", err);
        setTimeout(() => startUserChangeStream(db, cache), 5000);
    });
};
