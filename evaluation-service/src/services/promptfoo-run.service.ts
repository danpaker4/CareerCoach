import { spawn, type ChildProcess } from "node:child_process";
import { access } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { PROMPTFOO_LOG_TAIL_MAX_LINES } from "./promptfoo-run.consts";
import type { PromptfooRunConfig, PromptfooRunOptions, PromptfooRunSnapshot, PromptfooRunStatus } from "./promptfoo-run.types";

export class PromptfooRunConflictError extends Error {
    constructor() {
        super("A Promptfoo evaluation is already running");
        this.name = "PromptfooRunConflictError";
    }
}

export class PromptfooRunNotConfiguredError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "PromptfooRunNotConfiguredError";
    }
}

const createIdleSnapshot = (): PromptfooRunSnapshot => ({
    runId: null,
    status: "idle",
    startedAt: null,
    finishedAt: null,
    exitCode: null,
    options: {},
    logTail: [],
    error: null,
});

const appendLogLine = (lines: string[], chunk: string): string[] => {
    const nextLines = [...lines];
    for (const line of chunk.split(/\r?\n/)) {
        if (line.length === 0) {
            continue;
        }
        nextLines.push(line);
    }
    return nextLines.slice(-PROMPTFOO_LOG_TAIL_MAX_LINES);
};

const buildPromptfooArgs = (options: PromptfooRunOptions): string[] => {
    const args = ["scripts/run-promptfoo.ts", "eval", "-c", "promptfooconfig.ts", "--no-progress-bar"];
    if (options.noCache !== false) {
        args.push("--no-cache");
    }
    if (options.filterFirstN !== undefined) {
        args.push("--filter-first-n", String(options.filterFirstN));
    }
    if (options.filterPattern !== undefined && options.filterPattern.trim().length > 0) {
        args.push("--filter-pattern", options.filterPattern.trim());
    }
    return args;
};

export class PromptfooRunService {
    private snapshot: PromptfooRunSnapshot = createIdleSnapshot();
    private child: ChildProcess | null = null;

    constructor(private readonly config: PromptfooRunConfig) {}

    getStatus = (): PromptfooRunSnapshot => ({
        ...this.snapshot,
        options: { ...this.snapshot.options },
        logTail: [...this.snapshot.logTail],
    });

    private setStatus = (status: PromptfooRunStatus, patch: Partial<PromptfooRunSnapshot> = {}): void => {
        this.snapshot = {
            ...this.snapshot,
            ...patch,
            status,
        };
    };

    private assertPackageReady = async (): Promise<string> => {
        const packageDir = path.resolve(this.config.packageDir);
        const configPath = path.join(packageDir, "promptfooconfig.ts");
        const runnerPath = path.join(packageDir, "scripts", "run-promptfoo.ts");

        try {
            await access(configPath);
            await access(runnerPath);
        } catch {
            throw new PromptfooRunNotConfiguredError(
                `Promptfoo package not found at "${packageDir}". Set PROMPTFOO_PACKAGE_DIR or install evals/promptfoo.`,
            );
        }

        return packageDir;
    };

    startRun = async (options: PromptfooRunOptions): Promise<PromptfooRunSnapshot> => {
        if (this.snapshot.status === "running") {
            throw new PromptfooRunConflictError();
        }

        const packageDir = await this.assertPackageReady();
        const runId = randomUUID();
        const startedAt = new Date().toISOString();
        const args = buildPromptfooArgs(options);

        this.snapshot = {
            runId,
            status: "running",
            startedAt,
            finishedAt: null,
            exitCode: null,
            options,
            logTail: [`Starting Promptfoo: tsx ${args.join(" ")}`],
            error: null,
        };

        const child = spawn("npx", ["tsx", ...args], {
            cwd: packageDir,
            env: process.env,
            stdio: ["ignore", "pipe", "pipe"],
        });
        this.child = child;

        child.stdout?.setEncoding("utf8");
        child.stderr?.setEncoding("utf8");

        child.stdout?.on("data", (chunk: string) => {
            this.snapshot = {
                ...this.snapshot,
                logTail: appendLogLine(this.snapshot.logTail, chunk),
            };
        });

        child.stderr?.on("data", (chunk: string) => {
            this.snapshot = {
                ...this.snapshot,
                logTail: appendLogLine(this.snapshot.logTail, chunk),
            };
        });

        child.on("error", (error: Error) => {
            this.child = null;
            this.setStatus("failed", {
                finishedAt: new Date().toISOString(),
                exitCode: null,
                error: error.message,
                logTail: appendLogLine(this.snapshot.logTail, error.message),
            });
        });

        child.on("close", (code) => {
            this.child = null;
            const exitCode = code ?? 1;
            this.setStatus("completed", {
                finishedAt: new Date().toISOString(),
                exitCode,
                error:
                    exitCode === 0
                        ? null
                        : `Promptfoo finished with exit code ${exitCode} (some tests may have failed)`,
            });
        });

        return this.getStatus();
    };
}
