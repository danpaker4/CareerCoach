import fs from "node:fs";
import path from "node:path";
import { Server } from "./server";
import dotenv from "dotenv";
import { ServerEnvSchema } from "./server.types";

const serviceEnvPath = path.resolve(__dirname, "..", ".env");
if (fs.existsSync(serviceEnvPath)) {
    dotenv.config({ path: serviceEnvPath });
}
dotenv.config();

const env = ServerEnvSchema.parse(process.env);

const server = new Server({
  port: env.PORT,
  host: env.HOST,
  mongoConfig: {
    mongoConnectionString: env.MONGO_CONNECTION_STRING,
    mongoKeyPath: env.MONGO_KEY_PATH,
  },
});

server.start();
