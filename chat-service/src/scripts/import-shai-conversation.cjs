const { spawnSync } = require("node:child_process");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const rawConversation = require("./shai-conversation.seed.json");
const rawLegacyConversation = require("./shai-legacy-conversation.seed.json");

const TARGET_FIRST_NAME = "shai";
const TARGET_LAST_NAME = "shai";
const DEFAULT_MONGODB_CONTAINER = "mongodb-careercoach";
const DEFAULT_MONGODB_PORT = "27017";
const COMPLETED_STAGE_IDS = ["achievements", "timeline", "preferences"];
const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;

const readDotEnv = () => {
    const envPath = resolve(__dirname, "../..", ".env");
    try {
        return readFileSync(envPath, "utf8").split(/\r?\n/).reduce((values, line) => {
            const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z\d_]*)\s*=\s*(.*)\s*$/);
            if (!match) {
                return values;
            }
            const [, key, rawValue] = match;
            const value = rawValue.replace(/^(?:"([\s\S]*)"|'([\s\S]*)')$/, (_, doubleQuoted, singleQuoted) =>
                doubleQuoted ?? singleQuoted ?? "");
            return { ...values, [key]: value };
        }, {});
    } catch (error) {
        if (error && error.code === "ENOENT") {
            return {};
        }
        throw error;
    }
};

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

const createCompletedStageProgress = () => ({
    currentStageIndex: COMPLETED_STAGE_IDS.length,
    completedStageIds: COMPLETED_STAGE_IDS,
    awaitingConfirmation: false,
    stageNotes: {},
    surfacedAchievementIds: [],
});

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

const getDatabaseName = (connectionString, explicitDatabaseName) => {
    if (explicitDatabaseName) {
        return explicitDatabaseName;
    }
    if (!connectionString) {
        throw new Error("MONGO_CONNECTION_STRING or MONGO_DATABASE_NAME is required");
    }
    const databasePath = new URL(connectionString).pathname.replace(/^\//, "");
    if (!databasePath) {
        throw new Error("MONGO_CONNECTION_STRING must include a database name");
    }
    return decodeURIComponent(databasePath);
};

const createMongoShellScript = (payload) => `
const payload = JSON.parse(${JSON.stringify(JSON.stringify(payload))});
const database = db.getSiblingDB(payload.databaseName);
const users = await database.users.find(
    { firstName: /^shai$/i, lastName: /^shai$/i },
    { _id: 1, firstName: 1, lastName: 1 },
).limit(2).toArray();
if (users.length === 0) {
    throw new Error("No user named shai shai was found");
}
if (users.length > 1) {
    throw new Error("Multiple users named shai shai were found");
}
const targetUser = users[0];
const stageProgress = ${JSON.stringify(createCompletedStageProgress())};
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
    const existing = await database.conversations.findOne({ _id: conversationId });
    if (existing) {
        if (String(existing.userId) !== String(targetUser._id)) {
            throw new Error("Conversation " + importedConversation.conversationId + " belongs to a different user");
        }
        const matchesImport = JSON.stringify(existing.messages) === JSON.stringify(document.messages)
            && existing.createdAt.getTime() === document.createdAt.getTime()
            && existing.updatedAt.getTime() === document.updatedAt.getTime()
            && JSON.stringify(existing.stageProgress) === JSON.stringify(document.stageProgress);
        if (!matchesImport) {
            throw new Error("Conversation " + importedConversation.conversationId + " does not match the import");
        }
        print("Conversation " + importedConversation.conversationId + " already exists for shai shai");
        continue;
    }
    await database.conversations.insertOne(document);
    print(
        "Imported conversation " + importedConversation.conversationId + " with " + messages.length
            + " messages for " + targetUser.firstName + " " + targetUser.lastName,
    );
}
`;

const runImport = () => {
    const fileEnv = readDotEnv();
    const env = { ...fileEnv, ...process.env };
    const databaseName = getDatabaseName(env.MONGO_CONNECTION_STRING, env.MONGO_DATABASE_NAME);
    const containerName = env.MONGODB_CONTAINER || DEFAULT_MONGODB_CONTAINER;
    const mongoShellConnectionString = env.MONGO_IMPORT_CONNECTION_STRING
        || `mongodb://127.0.0.1:${DEFAULT_MONGODB_PORT}/${encodeURIComponent(databaseName)}?directConnection=true`;
    const payload = {
        databaseName,
        conversations: [
            normalizeCurrentConversation(rawConversation),
            normalizeLegacyConversation(rawLegacyConversation),
        ],
    };
    const result = spawnSync(
        "docker",
        ["exec", "-i", containerName, "mongosh", "--quiet", mongoShellConnectionString],
        {
            input: createMongoShellScript(payload),
            encoding: "utf8",
            stdio: ["pipe", "inherit", "inherit"],
        },
    );
    if (result.error) {
        throw result.error;
    }
    if (result.status !== 0) {
        throw new Error(`mongosh exited with status ${result.status}`);
    }
};

try {
    runImport();
} catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
}
