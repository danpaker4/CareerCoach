import { z } from "zod";

export const mongoEnvSchema = z.object({
    MONGO_KEY_PATH: z.string().optional(),
    MONGO_CONNECTION_STRING: z.string()
}).transform(({ MONGO_KEY_PATH, MONGO_CONNECTION_STRING }) => ({
    mongoConnectionString: MONGO_CONNECTION_STRING,
    mongoKeyPath: MONGO_KEY_PATH,
}));