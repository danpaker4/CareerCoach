import { FastifyInstance } from "fastify";
import { Collection } from "mongodb";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const chatRouter = (chatsCollection: Collection<any>) => async (app: FastifyInstance) => {
    
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
    const usersServiceBaseUrl = process.env.USERS_SERVICE_BASE_URL || "http://127.0.0.1:3001";

    app.post("/api/chat", async (req, reply) => {
        const { userId, message } = req.body as { userId: string, message: string };

        if (!message) return reply.status(400).send({ error: "Message is required" });

        try {
            let userContext = "The user is a guest.";
            if (userId) {
                try {
                    const response = await fetch(`${usersServiceBaseUrl}/users/${userId}`);
                    if (response.ok) {
                        const user = await response.json() as { firstName: string; lastName: string; currentJob?: string };
                        userContext = `User: ${user.firstName} ${user.lastName}, Current Job: ${user.currentJob || "N/A"}`;
                    }
                } catch (err) {
                    app.log.warn({ err, userId }, "Failed fetching user context from users-service");
                }
            }

            const historyDocs = await chatsCollection.find({ userId })
                .sort({ createdAt: -1 })
                .limit(5)
                .toArray();

            const chatHistory = historyDocs.reverse().map(doc => {
                if (doc.messages && doc.messages.length > 0) {
                    const userMsg = doc.messages.find((m: any) => m.role === 'user')?.text || "";
                    const modelMsg = doc.messages.find((m: any) => m.role === 'model')?.text || "";
                    return `User: ${userMsg}\nModel: ${modelMsg}`;
                }
                return "";
            }).join("\n\n");

            const prompt = `
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

            const result = await model.generateContent(prompt);
            const response = result.response.text();

            await chatsCollection.insertOne({
                userId,
                messages: [
                    { role: "user", text: message, timestamp: new Date() },
                    { role: "model", text: response, timestamp: new Date() }
                ],
                createdAt: new Date()
            });

            return reply.send({ response });

        } catch (error) {
            console.error("AI Error:", error);
            return reply.status(500).send({ response: "I'm having trouble connecting right now. Please try again." });
        }
    });
};