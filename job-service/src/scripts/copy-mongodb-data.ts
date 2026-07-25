import dotenv from "dotenv";
import {
    MongoClient,
    type AnyBulkWriteOperation,
    type Collection,
    type Document,
} from "mongodb";
import { MONGODB_COPY_BATCH_SIZE } from "./copy-mongodb-data.consts";

dotenv.config();

const copyCollection = async (
    sourceCollection: Collection<Document>,
    targetCollection: Collection<Document>,
): Promise<number> => {
    const operations: AnyBulkWriteOperation<Document>[] = [];
    const cursor = sourceCollection.find({});
    const flush = async (): Promise<void> => {
        if (operations.length === 0) return;
        const batch = operations.splice(0, operations.length);
        await targetCollection.bulkWrite(batch, { ordered: false });
    };

    for await (const document of cursor) {
        operations.push({
            replaceOne: {
                filter: { _id: document._id },
                replacement: document,
                upsert: true,
            },
        });
        if (operations.length >= MONGODB_COPY_BATCH_SIZE) {
            await flush();
        }
    }
    await flush();
    return sourceCollection.countDocuments();
};

const runCopy = async (): Promise<void> => {
    const sourceConnectionString = process.env.SOURCE_MONGO_CONNECTION_STRING;
    const targetConnectionString = process.env.TARGET_MONGO_CONNECTION_STRING;
    if (!sourceConnectionString || !targetConnectionString) {
        throw new Error(
            "SOURCE_MONGO_CONNECTION_STRING and TARGET_MONGO_CONNECTION_STRING are required",
        );
    }
    if (sourceConnectionString === targetConnectionString) {
        throw new Error("Source and target MongoDB connection strings must be different");
    }

    const sourceClient = new MongoClient(sourceConnectionString);
    const targetClient = new MongoClient(targetConnectionString);
    await Promise.all([sourceClient.connect(), targetClient.connect()]);
    try {
        const sourceDatabase = sourceClient.db();
        const targetDatabase = targetClient.db();
        const collections = await sourceDatabase
            .listCollections({}, { nameOnly: true })
            .toArray();
        const copiedCounts = await collections
            .filter((collection) => collection.type === "collection" && !collection.name.startsWith("system."))
            .reduce<Promise<Record<string, number>>>(async (countsPromise, collectionInfo) => {
                const counts = await countsPromise;
                const count = await copyCollection(
                    sourceDatabase.collection(collectionInfo.name),
                    targetDatabase.collection(collectionInfo.name),
                );
                console.log(`Copied ${count} documents from ${collectionInfo.name}`);
                return { ...counts, [collectionInfo.name]: count };
            }, Promise.resolve({}));
        console.log(JSON.stringify({ copiedCollections: copiedCounts }));
    } finally {
        await Promise.all([sourceClient.close(), targetClient.close()]);
    }
};

runCopy().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
});
