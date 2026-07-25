import type { Pipeline } from "../pipeline.model";
import { v4 as uuidv4 } from "uuid";

export const mockPipeline: Pipeline = {
    id: uuidv4(),
    userId: uuidv4(),
    stages: ["watchlist", "in progress", "done"],
};

export const testServerConfig = {
    port: 0,
    mongoConfig: {
        mongoConnectionString: "mongodb://127.0.0.1:27017",
        mongoKeyPath: undefined,
    },
};

