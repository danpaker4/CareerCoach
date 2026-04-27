import "dotenv/config";
import { z } from "zod";

const GithubEnvSchema = z.object({
  GITHUB_CLIENT_ID: z.string().min(1),
  GITHUB_CLIENT_SECRET: z.string().min(1),
});

export const getGithubConfig = () => GithubEnvSchema.parse(process.env);
