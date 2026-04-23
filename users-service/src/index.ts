import { Server } from "./server";
import dotenv from 'dotenv';

dotenv.config();

const server = new Server({
  port: parseInt(process.env.PORT || "3001", 10),
  mongoConfig: {
    mongoConnectionString: process.env.MONGO_CONNECTION_STRING || "mongodb://127.0.0.1:27017/careerCoachDB",
    mongoKeyPath: process.env.MONGO_KEY_PATH,
  },
});

server.start();