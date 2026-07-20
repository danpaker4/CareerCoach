import type { FastifyInstance } from "fastify";
import type { ServerConfig } from "../../server.types";
import type { MongoClient } from "../../mongo/mongo";
import { AdminAuthService } from "../admin/admin-auth.service";
import { BenchmarkController } from "./benchmark.controller";
import { BENCHMARK_ROUTE_PREFIX } from "./benchmark.consts";
import { BenchmarkRunDal } from "./benchmark.dal";
import { BenchmarkService } from "./benchmark.service";

export const benchmarkRouter = (dbClient: MongoClient, chatConfig: ServerConfig["chatConfig"]) => async (app: FastifyInstance) => {
    const dal = new BenchmarkRunDal(dbClient.benchmarkRuns);
    const service = new BenchmarkService(dbClient, chatConfig, dal);
    const authService = new AdminAuthService(chatConfig.usersServiceBaseUrl);
    const controller = new BenchmarkController(service, authService);

    app.get(`${BENCHMARK_ROUTE_PREFIX}/config`, controller.getConfig);
    app.get(`${BENCHMARK_ROUTE_PREFIX}/runs`, controller.listRuns);
    app.get(`${BENCHMARK_ROUTE_PREFIX}/runs/:runId`, controller.getRun);
    app.post(`${BENCHMARK_ROUTE_PREFIX}/runs`, controller.createRun);
};
