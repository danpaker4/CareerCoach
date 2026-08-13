const { spawnSync } = require("node:child_process");
const rawConversation = require("./shai-conversation.seed.json");
const rawLegacyConversation = require("./shai-legacy-conversation.seed.json");

const TARGET_FIRST_NAME = "shai";
const TARGET_LAST_NAME = "shai";
const DEFAULT_CHAT_CONTAINER = "careercoach-chat";
const COMPLETED_STAGE_IDS = ["achievements", "timeline", "preferences"];
const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;

const requireObjectId = (value, fieldName) => {
    if (typeof value !== "string" || !OBJECT_ID_PATTERN.test(value)) {
        throw new Error(`${fieldName} must be a 24-character MongoDB ObjectId`);
    }
    return value;
};

const requireString = (value, fieldName) => {
    if (typeof value !== "string") {
        throw new Error(`${fieldName} must be a string`);
    }
    return value;
};

const normalizeCurrentConversation = (value) => {
    const conversationId = requireObjectId(value.conversationId, "conversationId");
    if (!Array.isArray(value.messages) || value.messages.length === 0) {
        throw new Error(`Conversation ${conversationId} must contain messages`);
    }
    const messages = value.messages.map((message, index) => {
        const timestamp = new Date(requireString(message.timestamp, `messages[${index}].timestamp`));
        if (Number.isNaN(timestamp.getTime())) {
            throw new Error(`messages[${index}].timestamp must be an ISO date`);
        }
        return {
            role: requireString(message.role, `messages[${index}].role`),
            content: requireString(message.content, `messages[${index}].content`),
            timestamp: timestamp.toISOString(),
            ...(message.attachedJobs ? { attachedJobs: message.attachedJobs } : {}),
        };
    });
    return { conversationId, messages };
};

const normalizeLegacyConversation = (value) => {
    const conversationId = requireObjectId(value.id, "id");
    if (!Array.isArray(value.chat) || value.chat.length === 0) {
        throw new Error(`Conversation ${conversationId} must contain chat turns`);
    }
    const timestampOrigin = Number.parseInt(conversationId.slice(0, 8), 16) * 1000;
    const messagesWithoutTimestamps = value.chat.flatMap((turn, index) => {
        const user = requireString(turn.user, `chat[${index}].user`);
        const chatbot = requireString(turn.chatbot, `chat[${index}].chatbot`);
        return [
            ...(user.length > 0 ? [{ role: "user", content: user }] : []),
            ...(chatbot.length > 0 ? [{ role: "assistant", content: chatbot }] : []),
        ];
    });
    if (messagesWithoutTimestamps.length === 0) {
        throw new Error(`Conversation ${conversationId} must contain non-empty messages`);
    }
    const messages = messagesWithoutTimestamps.map((message, index) => ({
        ...message,
        timestamp: new Date(timestampOrigin + index).toISOString(),
    }));
    return { conversationId, messages };
};

const createContainerScript = (payload) => `
const { MongoClient, ObjectId } = require("mongodb");
const payload = JSON.parse(${JSON.stringify(JSON.stringify(payload))});

const run = async () => {
    const connectionString = process.env.MONGO_CONNECTION_STRING;
    if (!connectionString) {
        throw new Error("The chat container has no MONGO_CONNECTION_STRING");
    }
    const mongoKeyPath = process.env.MONGO_KEY_PATH;
    const options = mongoKeyPath && mongoKeyPath !== "none"
        ? { tlsCertificateKeyFile: mongoKeyPath }
        : {};
    const client = new MongoClient(connectionString, options);
    await client.connect();
    try {
        const database = client.db();
        console.log("Authenticated import target: database=" + database.databaseName);
        const users = await database.collection("users").find(
            { firstName: /^shai$/i, lastName: /^shai$/i },
            {
                collation: { locale: "en", strength: 2 },
                projection: { _id: 1, firstName: 1, lastName: 1 },
            },
        ).limit(2).toArray();
        if (users.length === 0) {
            throw new Error("No user named shai shai was found");
        }
        if (users.length > 1) {
            throw new Error("Multiple users named shai shai were found");
        }

        const targetUser = users[0];
        console.log("Resolved user: " + targetUser.firstName + " " + targetUser.lastName + " (" + targetUser._id + ")");
        const conversations = database.collection("conversations");
        const stageProgress = {
            currentStageIndex: ${COMPLETED_STAGE_IDS.length},
            completedStageIds: ${JSON.stringify(COMPLETED_STAGE_IDS)},
            awaitingConfirmation: false,
            stageNotes: {},
            surfacedAchievementIds: [],
        };
        const results = [];
        const session = client.startSession();
        try {
            await session.withTransaction(async () => {
                for (const importedConversation of payload.conversations) {
                    const conversationId = new ObjectId(importedConversation.conversationId);
                    const messages = importedConversation.messages.map((message) => ({
                        ...message,
                        timestamp: new Date(message.timestamp),
                    }));
                    const firstMessage = messages[0];
                    const lastMessage = messages[messages.length - 1];
                    const document = {
                        _id: conversationId,
                        userId: targetUser._id,
                        messages,
                        stageProgress,
                        createdAt: firstMessage.timestamp,
                        updatedAt: lastMessage.timestamp,
                    };
                    const existing = await conversations.findOne({ _id: conversationId }, { session });
                    if (existing) {
                        if (String(existing.userId) !== String(targetUser._id)) {
                            throw new Error(
                                "Conversation " + importedConversation.conversationId + " belongs to a different user",
                            );
                        }
                        const matchesImport = JSON.stringify(existing.messages) === JSON.stringify(document.messages)
                            && existing.createdAt.getTime() === document.createdAt.getTime()
                            && existing.updatedAt.getTime() === document.updatedAt.getTime()
                            && JSON.stringify(existing.stageProgress) === JSON.stringify(document.stageProgress);
                        if (!matchesImport) {
                            throw new Error(
                                "Conversation " + importedConversation.conversationId + " does not match the import",
                            );
                        }
                        results.push("UNCHANGED " + importedConversation.conversationId);
                        continue;
                    }
                    if (payload.dryRun) {
                        results.push(
                            "WOULD INSERT " + importedConversation.conversationId + " (" + messages.length + " messages)",
                        );
                        continue;
                    }
                    await conversations.insertOne(document, { session });
                    results.push("INSERTED " + importedConversation.conversationId + " (" + messages.length + " messages)");
                }
            });
        } finally {
            await session.endSession();
        }
        results.forEach((result) => console.log(result));
        console.log(payload.dryRun ? "Dry run complete: no data was changed" : "Import transaction committed");
    } finally {
        await client.close();
    }
};

run().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
});
`;

const runImport = () => {
    const containerName = process.env.CHAT_SERVICE_CONTAINER || DEFAULT_CHAT_CONTAINER;
    const payload = {
        dryRun: process.argv.includes("--dry-run"),
        conversations: [
            normalizeCurrentConversation(rawConversation),
            normalizeLegacyConversation(rawLegacyConversation),
        ],
    };
    console.log(`Execution target: container=${containerName}`);
    const result = spawnSync(
        "docker",
        ["exec", "-i", containerName, "node"],
        {
            input: createContainerScript(payload),
            encoding: "utf8",
            stdio: ["pipe", "inherit", "inherit"],
        },
    );
    if (result.error) {
        throw result.error;
    }
    if (result.status !== 0) {
        throw new Error(`Container import exited with status ${result.status}`);
    }
};

if (require.main === module) {
    try {
        runImport();
    } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
    }
}

module.exports = { createContainerScript, normalizeCurrentConversation, normalizeLegacyConversation };
