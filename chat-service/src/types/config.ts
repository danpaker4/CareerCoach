import z from "zod";

export interface CommonServerConfig {
  port: number;
  host?: string;
}

export const envString = (name: string) =>
  z.string().min(1, `${name} is required`);

export const envNumber = (name: string) =>
  z.coerce.number(`${name} is required`).int().positive();

export const MongoConfigSchema = z.object({
  mongoConnectionString: z.string(),
  mongoKeyPath: z.string().optional(),
});

export const ServerConfigSchema = z.object({
  port: z.number(),
  host: z.string(),
});

export const GithubConfigSchema = z.object({
  clientId: z.string(),
  clientSecret: z.string(),
});

export const SystemConfigSchema = z.object({
  serverConfig: ServerConfigSchema,
  mongoConfig: MongoConfigSchema,
  githubConfig: GithubConfigSchema,
});

export const EnvSchema = z.object({
  MONGO_CONNECTION_STRING: envString("mongoConnectionString"),
  MONGO_KEY_PATH: envString("mongoKeyPath"),
  PORT: envNumber("port"),
  HOST: envString("host"),
  GITHUB_CLIENT_ID: envString("githubClientId"),
  GITHUB_CLIENT_SECRET: envString("githubClientSecret"),
});

export type Env = z.infer<typeof EnvSchema>;

export const createSystemConfig = (env: Env): ServerConfig => {
  return {
    serverConfig: {
      port: env.PORT,
      host: env.HOST,
    },
    mongoConfig: {
      mongoConnectionString: env.MONGO_CONNECTION_STRING,
      mongoKeyPath: env.MONGO_KEY_PATH,
    },
    githubConfig: {
      clientId: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET
    }
  };
};

export type ServerConfig = z.infer<typeof SystemConfigSchema>;
