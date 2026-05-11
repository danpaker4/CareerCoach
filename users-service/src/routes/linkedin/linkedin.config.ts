import "dotenv/config";
import { z } from "zod";

const LinkedInEnvSchema = z.object({
  LINKEDIN_CLIENT_ID: z.string().min(1),
  LINKEDIN_CLIENT_SECRET: z.string().min(1),
});

export const getLinkedInConfig = () => LinkedInEnvSchema.parse(process.env);
