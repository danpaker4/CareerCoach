import { FastifyInstance } from "fastify";
import { Collection } from "mongodb";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const chatRouter = (chatsCollection: Collection<any>, usersCollection: Collection<any>) => async (app: FastifyInstance) => {
    
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

    app.post("/api/chat", async (req, reply) => {
        const { userId, message } = req.body as { userId: string, message: string };

        if (!message) return reply.status(400).send({ error: "Message is required" });

        try {
            // Fetch User Context
            let userContext = "The user is a guest.";
            const user = await usersCollection.findOne({ id: userId });
            if (user) {
                userContext = `User: ${user.firstName} ${user.lastName}, Current Job: ${user.currentJob || "N/A"}`;
            }

            // Fetch Chat History (Limit 5)
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

            // AI System Prompt
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

            // Generate Content
            const result = await model.generateContent(prompt);
            const response = result.response.text();

            // Save to DB
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