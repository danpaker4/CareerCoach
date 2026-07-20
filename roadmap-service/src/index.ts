import "./observability/register";
import dotenv from "dotenv";
import { Server } from "./server";
import { createConfigFromEnv } from "./config";

dotenv.config();

const config = createConfigFromEnv(process.env);
const server = new Server(config);

server.start();
