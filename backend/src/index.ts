import { Server } from "./server";

const server = new Server(
  {
    port: 3000,
    host: "0.0.0.0",
  }
); 

server.start();