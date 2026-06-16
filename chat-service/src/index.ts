import "./observability/register";
import { Server } from "./server";
import dotenv from 'dotenv';
import { createConfigFromEnv } from "./config";

dotenv.config();

const config = createConfigFromEnv(process.env);
const server = new Server(config);

server.start();
