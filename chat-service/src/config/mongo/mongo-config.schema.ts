import { z } from "zod";
import { envString } from "../env.utils";

export const mongoConfigEnvSchema = z.object({
    MONGO_CONNECTION_STRING: envString("MONGO_CONNECTION_STRING"),
    MONGO_KEY_PATH: z.string().optional(),
});

export type MongoConfigEnv = z.infer<typeof mongoConfigEnvSchema>;
