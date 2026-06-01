import type { Db } from "mongodb";
import type { UserEmbeddingCache } from "./user-embedding.cache";

const RECONNECT_DELAY_MS = 5_000;
const CHANGE_STREAM_UNSUPPORTED_CODE = 40573;
const CHANGE_STREAM_UNSUPPORTED_CODE_NAME = "Location40573";
const CHANGE_STREAM_REPLICA_SET_MESSAGE = "$changeStream stage is only supported on replica sets";

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null;

const hasUnsupportedChangeStreamCode = (value: Record<string, unknown>): boolean =>
    value.code === CHANGE_STREAM_UNSUPPORTED_CODE || value.codeName === CHANGE_STREAM_UNSUPPORTED_CODE_NAME;

const hasUnsupportedChangeStreamMessage = (value: unknown): boolean =>
    typeof value === "string" && value.includes(CHANGE_STREAM_REPLICA_SET_MESSAGE);

const isChangeStreamUnsupportedError = (error: unknown): boolean => {
    if (!isRecord(error)) {
        return error instanceof Error && hasUnsupportedChangeStreamMessage(error.message);
    }

    const errorResponse = isRecord(error.errorResponse) ? error.errorResponse : null;
    return (
        hasUnsupportedChangeStreamCode(error) ||
        (errorResponse !== null && hasUnsupportedChangeStreamCode(errorResponse)) ||
        hasUnsupportedChangeStreamMessage(error.message) ||
        (errorResponse !== null && hasUnsupportedChangeStreamMessage(errorResponse.errmsg))
    );
};

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

    changeStream.on("error", (err: unknown) => {
        if (isChangeStreamUnsupportedError(err)) {
            console.warn("[ChangeStream] Disabled users collection watcher: MongoDB change streams require a replica set");
            void changeStream.close().catch((closeError: unknown) => {
                console.warn("[ChangeStream] Failed to close unsupported users collection watcher:", closeError);
            });
            return;
        }

        console.error("[ChangeStream] Error on users collection:", err);
        setTimeout(() => startUserChangeStream(db, cache), RECONNECT_DELAY_MS);
    });

    console.log("[ChangeStream] Watching users collection for embedding updates");
};
