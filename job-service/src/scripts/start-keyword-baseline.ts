import dotenv from "dotenv";

dotenv.config();

process.env.GEMINI_API_KEY = "";
process.env.JOBS_VECTOR_SEARCH_ENABLED = "false";

const startKeywordBaseline = async (): Promise<void> => {
    const { Server } = await import("../server");
    const server = new Server({
        port: Number(process.env.PORT ?? "3013"),
        mongoConfig: {
            mongoConnectionString: process.env.MONGO_CONNECTION_STRING
                ?? "mongodb://127.0.0.1:27018/careerCoachDB?directConnection=true",
            mongoKeyPath: process.env.MONGO_KEY_PATH,
        },
    });
    await server.start();
};

startKeywordBaseline().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
});
