import { Server } from "./server";

const server = new Server(
  {
    port: 3000,
    host: "0.0.0.0",
    mongoConfig: {
      mongoConnectionString: "mongodb://localhost:27017",
      mongoKeyPath: undefined
    }
  }
); 

server.start();