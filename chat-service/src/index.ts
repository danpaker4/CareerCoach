import fs from "node:fs";
import path from "node:path";
import { Server } from "./server";
import dotenv from "dotenv";
import { createConfigFromEnv } from "./config";

const serviceEnvPath = path.resolve(__dirname, "..", ".env");
if (fs.existsSync(serviceEnvPath)) {
    dotenv.config({ path: serviceEnvPath });
}
dotenv.config();

const config = createConfigFromEnv(process.env);
const server = new Server(config);

server.start();