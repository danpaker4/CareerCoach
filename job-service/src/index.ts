import fs from "node:fs";
import path from "node:path";
import { Server } from "./server";
import dotenv from "dotenv";

const serviceEnvPath = path.resolve(__dirname, "..", ".env");
if (fs.existsSync(serviceEnvPath)) {
    dotenv.config({ path: serviceEnvPath });
}
dotenv.config();

const server = new Server({
  port: parseInt(process.env.PORT || "3003", 10),
  mongoConfig: {
    mongoConnectionString: process.env.MONGO_CONNECTION_STRING || "mongodb://127.0.0.1:27017/careerCoachDB",
    mongoKeyPath: process.env.MONGO_KEY_PATH,
  },
});

server.start();