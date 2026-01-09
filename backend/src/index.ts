import { Server } from "./server";
import { createSystemConfig, EnvSchema, ServerConfig } from "./types/config";
import dotenv from 'dotenv';

dotenv.config();

const config: ServerConfig = createSystemConfig(EnvSchema.parse(process.env))

const server = new Server(config);

server.start();