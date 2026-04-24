import { FastifyInstance } from "fastify";
import { Collection } from "mongodb";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { ChatMessage, ChatSession } from "./chat.model";
import type { ChatRequestBody, UserContextResponse } from "./chat.types";

const DEFAULT_USER_CONTEXT = "The user is a guest.";
const HISTORY_LIMIT = 5;

const isChatRequestBody = (body: unknown): body is ChatRequestBody => {
    if (typeof body !== "object" || body === null || !("message" in body)) {
        return false;
    }

    return (
        typeof body.message === "string" &&
        (!("userId" in body) || typeof body.userId === "string")
    );
};

const isUserContextResponse = (payload: unknown): payload is UserContextResponse => {
    if (typeof payload !== "object" || payload === null) {
        return false;
    }

    return (
        "firstName" in payload &&
        "lastName" in payload &&
        typeof payload.firstName === "string" &&
        typeof payload.lastName === "string" &&
        (!("currentJob" in payload) || typeof payload.currentJob === "string")
    );
};

const readUserContext = async (usersServiceBaseUrl: string, userId?: string): Promise<string> => {
    if (!userId) {
        return DEFAULT_USER_CONTEXT;
    }

    const response = await fetch(`${usersServiceBaseUrl}/users/${userId}`);
    if (!response.ok) {
        return DEFAULT_USER_CONTEXT;
    }

    const payload: unknown = await response.json().catch(() => null);
    if (!isUserContextResponse(payload)) {
        return DEFAULT_USER_CONTEXT;
    }

    return `User: ${payload.firstName} ${payload.lastName}, Current Job: ${payload.currentJob || "N/A"}`;
};

const messageTextByRole = (messages: readonly ChatMessage[], role: ChatMessage["role"]): string =>
    messages.find((message) => message.role === role)?.text || "";

const formatChatHistory = (historyDocs: readonly ChatSession[]): string =>
    [...historyDocs]
        .reverse()
        .map((doc) => {
            if (doc.messages.length === 0) {
                return "";
            }

            const userMsg = messageTextByRole(doc.messages, "user");
            const modelMsg = messageTextByRole(doc.messages, "model");
            return `User: ${userMsg}\nModel: ${modelMsg}`;
        })
        .join("\n\n");

const buildPrompt = (userContext: string, chatHistory: string, message: string): string => `
    You are 'CareerCoach', an expert, encouraging, and thorough AI Career Counselor.
    
    *** USER INFO ***
    ${userContext}

    *** CONVERSATION HISTORY ***
    ${chatHistory ? chatHistory : "No previous history."}
    
    *** NEW MESSAGE ***
    User: "${message}"
    
    *** INSTRUCTIONS ***
    1. **Identity:** You are CareerCoach. Never call yourself anything else.
    2. **Be Detailed:** Provide comprehensive explanations, step-by-step guides, and examples.
    3. **Be Proactive:** Always end with a relevant follow-up question.
    4. **Structure:** Use bold headers, bullet points, and clear paragraphs.
    5. **Tone:** Professional, motivating, and personalized.
`;

export const chatRouter = (chatsCollection: Collection<ChatSession>) => async (app: FastifyInstance) => {
    
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
    const usersServiceBaseUrl = process.env.USERS_SERVICE_BASE_URL || "http://127.0.0.1:3001";

    app.post("/api/chat", async (req, reply) => {
        if (!isChatRequestBody(req.body)) {
            return reply.status(400).send({ error: "Message is required" });
        }

        const { userId, message } = req.body;
        if (!message.trim()) return reply.status(400).send({ error: "Message is required" });
        const resolvedUserId = userId || "guest";

        try {
            const userContext = await readUserContext(usersServiceBaseUrl, userId).catch((err) => {
                app.log.warn({ err, userId }, "Failed fetching user context from users-service");
                return DEFAULT_USER_CONTEXT;
            });

            const historyDocs = await chatsCollection.find({ userId: resolvedUserId })
                .sort({ createdAt: -1 })
                .limit(HISTORY_LIMIT)
                .toArray();

            const chatHistory = formatChatHistory(historyDocs);
            const prompt = buildPrompt(userContext, chatHistory, message);

            const result = await model.generateContent(prompt);
            const response = result.response.text();

            await chatsCollection.insertOne({
                userId: resolvedUserId,
                messages: [
                    { role: "user", text: message, timestamp: new Date() },
                    { role: "model", text: response, timestamp: new Date() }
                ],
                createdAt: new Date()
            });

            return reply.send({ response });

        } catch (error) {
            app.log.error({ error }, "AI Error");
            return reply.status(500).send({ response: "I'm having trouble connecting right now. Please try again." });
        }
    });
};