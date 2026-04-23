import { z } from "zod";

export const mongoEnvSchema = z.object({
    MONGO_KEY_PATH: z.string().optional(),
    MONGO_URL: z.string()
}).transform(({ MONGO_KEY_PATH, MONGO_URL }) => ({
    mongoConnectionString: MONGO_URL,
    mongoKeyPath: MONGO_KEY_PATH,
}));