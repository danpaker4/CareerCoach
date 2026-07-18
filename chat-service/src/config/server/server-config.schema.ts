import { z } from "zod";
import { envString } from "../env.utils";

export const serverConfigEnvSchema = z.object({
    PORT: z.coerce.number().int().positive().default(3002),
    HOST: envString("HOST"),
});

export type ServerConfigEnv = z.infer<typeof serverConfigEnvSchema>;
