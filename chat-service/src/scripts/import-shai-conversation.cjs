const dotenv = require("dotenv");
const { MongoClient, ObjectId } = require("mongodb");
const { isDeepStrictEqual } = require("node:util");
const { z } = require("zod");
const rawConversation = require("./shai-conversation.seed.json");
const rawLegacyConversation = require("./shai-legacy-conversation.seed.json");

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

const LegacyConversationExportSchema = z.object({
    id: z.string().refine((value) => ObjectId.isValid(value), "Invalid conversation id"),
    chat: z.array(z.object({
        user: z.string(),
        chatbot: z.string(),
    }).strict()).min(1),
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

const normalizeCurrentConversation = (value) => {
    const exportedConversation = ConversationExportSchema.parse(value);
    return {
        conversationId: exportedConversation.conversationId,
        messages: exportedConversation.messages.map((message) => ({
            ...message,
            timestamp: new Date(message.timestamp),
        })),
    };
};

const normalizeLegacyConversation = (value) => {
    const exportedConversation = LegacyConversationExportSchema.parse(value);
    const conversationId = new ObjectId(exportedConversation.id);
    const timestampOrigin = conversationId.getTimestamp().getTime();
    const messagesWithoutTimestamps = exportedConversation.chat.flatMap((turn) => [
        ...(turn.user.length > 0 ? [{ role: "user", content: turn.user }] : []),
        ...(turn.chatbot.length > 0 ? [{ role: "assistant", content: turn.chatbot }] : []),
    ]);

    return {
        conversationId: exportedConversation.id,
        messages: messagesWithoutTimestamps.map((message, index) => ({
            ...message,
            timestamp: new Date(timestampOrigin + index),
        })),
    };
};

const ensureConversation = async (conversationsCollection, targetUser, conversation) => {
    const conversationId = new ObjectId(conversation.conversationId);
    const firstMessage = conversation.messages[0];
    const lastMessage = conversation.messages.at(-1);
    if (!firstMessage || !lastMessage) {
        throw new Error("The conversation must contain at least one message");
    }

    const existingConversation = await conversationsCollection.findOne({ _id: conversationId });
    const stageProgress = createCompletedStageProgress();

    if (existingConversation) {
        if (existingConversation.userId !== targetUser._id) {
            throw new Error(`Conversation ${conversation.conversationId} already belongs to a different user`);
        }
        const matchesImport = isDeepStrictEqual(
            serializeMessages(existingConversation.messages),
            serializeMessages(conversation.messages),
        )
            && existingConversation.createdAt.getTime() === firstMessage.timestamp.getTime()
            && existingConversation.updatedAt.getTime() === lastMessage.timestamp.getTime()
            && isDeepStrictEqual(existingConversation.stageProgress, stageProgress);
        if (!matchesImport) {
            throw new Error(`Conversation ${conversation.conversationId} already exists but does not match the import`);
        }
        console.log(
            `Conversation ${conversation.conversationId} already exists for ${TARGET_FIRST_NAME} ${TARGET_LAST_NAME}`,
        );
        return;
    }

    await conversationsCollection.insertOne({
        _id: conversationId,
        userId: targetUser._id,
        messages: conversation.messages,
        stageProgress,
        createdAt: firstMessage.timestamp,
        updatedAt: lastMessage.timestamp,
    });
    console.log(
        `Imported conversation ${conversation.conversationId} with ${conversation.messages.length} messages `
            + `for ${targetUser.firstName} ${targetUser.lastName}`,
    );
};

const runImport = async () => {
    const env = ImportEnvSchema.parse(process.env);
    const conversations = [
        normalizeCurrentConversation(rawConversation),
        normalizeLegacyConversation(rawLegacyConversation),
    ];
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
        const conversationsCollection = database.collection("conversations");
        await conversations.reduce(
            (previousImport, conversation) => previousImport.then(
                () => ensureConversation(conversationsCollection, targetUser, conversation),
            ),
            Promise.resolve(),
        );
    } finally {
        await client.close();
    }
};

runImport().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
});
