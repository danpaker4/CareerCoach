import type { FastifyReply, FastifyRequest } from "fastify";
import { StatusCodes } from "http-status-codes";
import { BENCHMARK_DEFAULT_RUN_LIMIT, BENCHMARK_MAX_RUN_LIMIT } from "./benchmark.consts";
import { BenchmarkAdminAuthService } from "./benchmark-admin-auth.service";
import { BenchmarkService } from "./benchmark.service";
import type { BenchmarkCandidateId, BenchmarkRunRequest, BenchmarkScoresRequest } from "./benchmark.types";
import type { BenchmarkAdminAuthResult } from "./benchmark-admin-auth.service";

const isBenchmarkCandidateId = (value: unknown): value is BenchmarkCandidateId =>
    value === "ollama-llama" || value === "gemini";

const readAuthorizationHeader = (request: FastifyRequest): string | undefined => {
    const header = request.headers.authorization;
    return typeof header === "string" ? header : undefined;
};

const parseRunLimit = (request: FastifyRequest): number => {
    const query = request.query;
    if (typeof query !== "object" || query === null || !("limit" in query)) {
        return BENCHMARK_DEFAULT_RUN_LIMIT;
    }

    const limitValue = Number((query as Record<string, unknown>).limit);
    if (!Number.isFinite(limitValue)) {
        return BENCHMARK_DEFAULT_RUN_LIMIT;
    }

    return Math.max(1, Math.min(BENCHMARK_MAX_RUN_LIMIT, Math.trunc(limitValue)));
};

const parseRunRequest = (body: unknown): BenchmarkRunRequest => {
    if (typeof body !== "object" || body === null) {
        return {};
    }

    const record = body as Record<string, unknown>;
    return {
        caseIds: Array.isArray(record.caseIds)
            ? record.caseIds.filter((caseId): caseId is string => typeof caseId === "string")
            : undefined,
        candidateIds: Array.isArray(record.candidateIds)
            ? record.candidateIds.filter(isBenchmarkCandidateId)
            : undefined,
    };
};

const isScoreValue = (value: unknown): value is number =>
    typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5;

const parseScoresRequest = (body: unknown): BenchmarkScoresRequest | null => {
    if (typeof body !== "object" || body === null) {
        return null;
    }

    const record = body as Record<string, unknown>;
    const manualScore = record.manualScore;
    if (!isBenchmarkCandidateId(record.candidateId) || typeof manualScore !== "object" || manualScore === null) {
        return null;
    }

    const scoreRecord = manualScore as Record<string, unknown>;
    if (
        !isScoreValue(scoreRecord.relevance) ||
        !isScoreValue(scoreRecord.personalization) ||
        !isScoreValue(scoreRecord.actionability) ||
        !isScoreValue(scoreRecord.clarity) ||
        !isScoreValue(scoreRecord.safety)
    ) {
        return null;
    }

    return {
        candidateId: record.candidateId,
        manualScore: {
            relevance: scoreRecord.relevance,
            personalization: scoreRecord.personalization,
            actionability: scoreRecord.actionability,
            clarity: scoreRecord.clarity,
            safety: scoreRecord.safety,
            notes: typeof scoreRecord.notes === "string" ? scoreRecord.notes : "",
        },
    };
};

const sendAuthFailure = (authResult: BenchmarkAdminAuthResult, reply: FastifyReply): boolean => {
    if (authResult.status === "success") {
        return false;
    }

    reply.status(authResult.failure.statusCode).send({
        error: authResult.failure.error,
        ...(authResult.failure.errorCode ? { errorCode: authResult.failure.errorCode } : {}),
    });
    return true;
};

export class BenchmarkController {
    constructor(
        private readonly benchmarkService: BenchmarkService,
        private readonly authService: BenchmarkAdminAuthService
    ) { }

    getConfig = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
        const authResult = await this.authService.verifyAdmin(readAuthorizationHeader(request));
        if (sendAuthFailure(authResult, reply)) {
            return;
        }

        reply.status(StatusCodes.OK).send(this.benchmarkService.getConfig());
    };

    listRuns = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
        const authResult = await this.authService.verifyAdmin(readAuthorizationHeader(request));
        if (sendAuthFailure(authResult, reply)) {
            return;
        }

        reply.status(StatusCodes.OK).send({ runs: await this.benchmarkService.listRuns(parseRunLimit(request)) });
    };

    getRun = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
        const authResult = await this.authService.verifyAdmin(readAuthorizationHeader(request));
        if (sendAuthFailure(authResult, reply)) {
            return;
        }

        const { runId } = request.params as { runId: string };
        const run = await this.benchmarkService.getRun(runId);
        if (!run) {
            reply.status(StatusCodes.NOT_FOUND).send({ error: "Benchmark run not found" });
            return;
        }

        reply.status(StatusCodes.OK).send(run);
    };

    createRun = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
        const authResult = await this.authService.verifyAdmin(readAuthorizationHeader(request));
        if (authResult.status === "failure") {
            sendAuthFailure(authResult, reply);
            return;
        }

        try {
            const run = await this.benchmarkService.runBenchmark(parseRunRequest(request.body), authResult.session.adminUserId);
            reply.status(StatusCodes.CREATED).send(run);
        } catch (error) {
            request.log.error({ error }, "Failed running chat benchmark");
            reply.status(StatusCodes.INTERNAL_SERVER_ERROR).send({
                error: "Failed running chat benchmark",
                details: error instanceof Error ? error.message : String(error),
            });
        }
    };

    updateScores = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
        const authResult = await this.authService.verifyAdmin(readAuthorizationHeader(request));
        if (sendAuthFailure(authResult, reply)) {
            return;
        }

        const scoreRequest = parseScoresRequest(request.body);
        if (!scoreRequest) {
            reply.status(StatusCodes.BAD_REQUEST).send({ error: "candidateId and 1-5 manual scores are required" });
            return;
        }

        const { runId } = request.params as { runId: string };
        const run = await this.benchmarkService.updateManualScore(runId, scoreRequest);
        if (!run) {
            reply.status(StatusCodes.NOT_FOUND).send({ error: "Benchmark run not found" });
            return;
        }

        reply.status(StatusCodes.OK).send(run);
    };
}
