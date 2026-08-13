const dotenv = require("dotenv");
const { MongoClient, ObjectId } = require("mongodb");
const { isDeepStrictEqual } = require("node:util");
const { z } = require("zod");
const rawConversation = require("./shai-conversation.seed.json");

dotenv.config();

const TARGET_FIRST_NAME = "shai";
const TARGET_LAST_NAME = "shai";
const COMPLETED_STAGE_IDS = ["achievements", "timeline", "preferences"];

const ImportEnvSchema = z.object({
    MONGO_CONNECTION_STRING: z.string().trim().min(1, "MONGO_CONNECTION_STRING is required"),
    MONGO_KEY_PATH: z.string().trim().min(1).optional(),
});

const AttachedJobSchema = z.object({
    jobId: z.string(),
    jobTitle: z.string(),
    url: z.string(),
    seniority: z.string(),
    description: z.string(),
    company: z.string(),
    salary: z.number().finite(),
}).strict();

const ConversationMessageSchema = z.object({
    role: z.enum(["system", "user", "assistant"]),
    content: z.string(),
    timestamp: z.string().datetime(),
    attachedJobs: z.array(AttachedJobSchema).optional(),
}).strict();

const ConversationExportSchema = z.object({
    conversationId: z.string().refine((value) => ObjectId.isValid(value), "Invalid conversationId"),
    userId: z.string().uuid(),
    currentStageId: z.null(),
    achievements: z.array(z.unknown()),
    messages: z.array(ConversationMessageSchema).min(1),
}).strict();

const TargetUserSchema = z.object({
    _id: z.string().uuid(),
    firstName: z.string(),
    lastName: z.string(),
});

const getMongoClientOptions = (mongoKeyPath) =>
    mongoKeyPath && mongoKeyPath !== "none" ? { tlsCertificateKeyFile: mongoKeyPath } : {};

const createCompletedStageProgress = () => ({
    currentStageIndex: COMPLETED_STAGE_IDS.length,
    completedStageIds: COMPLETED_STAGE_IDS,
    awaitingConfirmation: false,
    stageNotes: {},
    surfacedAchievementIds: [],
});

const serializeMessages = (messages) => messages.map((message) => ({
    ...message,
    timestamp: message.timestamp.toISOString(),
}));

const runImport = async () => {
    const env = ImportEnvSchema.parse(process.env);
    const exportedConversation = ConversationExportSchema.parse(rawConversation);
    const client = new MongoClient(
        env.MONGO_CONNECTION_STRING,
        getMongoClientOptions(env.MONGO_KEY_PATH),
    );

    await client.connect();
    try {
        const database = client.db();
        const usersCollection = database.collection("users");
        const matchingUsers = await usersCollection.find(
            { firstName: TARGET_FIRST_NAME, lastName: TARGET_LAST_NAME },
            {
                collation: { locale: "en", strength: 2 },
                projection: { _id: 1, firstName: 1, lastName: 1 },
            },
        ).limit(2).toArray();

        if (matchingUsers.length === 0) {
            throw new Error(`No user named ${TARGET_FIRST_NAME} ${TARGET_LAST_NAME} was found`);
        }
        if (matchingUsers.length > 1) {
            throw new Error(`Multiple users named ${TARGET_FIRST_NAME} ${TARGET_LAST_NAME} were found`);
        }

        const targetUser = TargetUserSchema.parse(matchingUsers[0]);
        const conversationId = new ObjectId(exportedConversation.conversationId);
        const messages = exportedConversation.messages.map((message) => ({
            ...message,
            timestamp: new Date(message.timestamp),
        }));
        const firstMessage = messages[0];
        const lastMessage = messages.at(-1);
        if (!firstMessage || !lastMessage) {
            throw new Error("The conversation must contain at least one message");
        }

        const conversationsCollection = database.collection("conversations");
        const existingConversation = await conversationsCollection.findOne({ _id: conversationId });
        const stageProgress = createCompletedStageProgress();

        if (existingConversation) {
            if (existingConversation.userId !== targetUser._id) {
                throw new Error(
                    `Conversation ${exportedConversation.conversationId} already belongs to a different user`,
                );
            }
            const matchesExport = isDeepStrictEqual(
                serializeMessages(existingConversation.messages),
                exportedConversation.messages,
            )
                && existingConversation.createdAt.getTime() === firstMessage.timestamp.getTime()
                && existingConversation.updatedAt.getTime() === lastMessage.timestamp.getTime()
                && isDeepStrictEqual(existingConversation.stageProgress, stageProgress);
            if (!matchesExport) {
                throw new Error(
                    `Conversation ${exportedConversation.conversationId} already exists but does not match the import`,
                );
            }
            console.log(
                `Conversation ${exportedConversation.conversationId} already exists for ${TARGET_FIRST_NAME} ${TARGET_LAST_NAME}`,
            );
            return;
        }

        await conversationsCollection.insertOne({
            _id: conversationId,
            userId: targetUser._id,
            messages,
            stageProgress,
            createdAt: firstMessage.timestamp,
            updatedAt: lastMessage.timestamp,
        });
        console.log(
            `Imported conversation ${exportedConversation.conversationId} with ${messages.length} messages `
                + `for ${targetUser.firstName} ${targetUser.lastName}`,
        );
    } finally {
        await client.close();
    }
};

runImport().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
});
