import dotenv from "dotenv";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { z } from "zod";

dotenv.config();

const DEFAULT_OTLP_ENDPOINT = "http://127.0.0.1:4318";
const DEFAULT_DEPLOYMENT_ENVIRONMENT = "local";
const DEFAULT_SERVICE_NAME = "careercoach.job-service";
const OTLP_TRACES_PATH = "/v1/traces";

const optionalEmptyString = (value: unknown): unknown =>
    typeof value === "string" && value.trim().length === 0 ? undefined : value;

const optionalUrlSchema = z.preprocess(optionalEmptyString, z.string().url().optional());

const defaultedUrlSchema = (defaultValue: string) =>
    z.preprocess(optionalEmptyString, z.string().url().default(defaultValue));

const booleanStringSchema = z.preprocess(
    (value: unknown): boolean => typeof value === "boolean" ? value : typeof value === "string" && value.toLowerCase() === "true",
    z.boolean()
);

const EnvSchema = z.object({
    OTEL_ENABLED: booleanStringSchema.default(false),
    OTEL_SERVICE_NAME: z.preprocess(optionalEmptyString, z.string().min(1).optional()),
    OTEL_EXPORTER_OTLP_ENDPOINT: defaultedUrlSchema(DEFAULT_OTLP_ENDPOINT),
    OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: optionalUrlSchema,
    OTEL_DEPLOYMENT_ENVIRONMENT: z.preprocess(
        optionalEmptyString,
        z.string().min(1).default(DEFAULT_DEPLOYMENT_ENVIRONMENT)
    ),
    OTEL_TRACES_SAMPLER: z
        .enum(["always_on", "always_off", "traceidratio", "parentbased_always_on", "parentbased_always_off", "parentbased_traceidratio"])
        .default("parentbased_traceidratio"),
    OTEL_TRACES_SAMPLER_ARG: z.preprocess(optionalEmptyString, z.coerce.number().min(0).max(1).default(1)),
});

const trimTrailingSlashes = (value: string): string => value.replace(/\/+$/, "");

const resolveTraceEndpoint = (otlpEndpoint: string, traceEndpoint?: string): string =>
    traceEndpoint ?? `${trimTrailingSlashes(otlpEndpoint)}${OTLP_TRACES_PATH}`;

const configureSamplerEnv = (sampler: z.infer<typeof EnvSchema>["OTEL_TRACES_SAMPLER"], ratio: number): void => {
    process.env.OTEL_TRACES_SAMPLER = sampler;
    process.env.OTEL_TRACES_SAMPLER_ARG = String(ratio);
};

const registerOpenTelemetry = (): void => {
    const env = EnvSchema.parse(process.env);
    if (!env.OTEL_ENABLED) {
        return;
    }

    const serviceName = env.OTEL_SERVICE_NAME ?? DEFAULT_SERVICE_NAME;
    const traceEndpoint = resolveTraceEndpoint(env.OTEL_EXPORTER_OTLP_ENDPOINT, env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT);
    configureSamplerEnv(env.OTEL_TRACES_SAMPLER, env.OTEL_TRACES_SAMPLER_ARG);

    const sdk = new NodeSDK({
        resource: resourceFromAttributes({
            "service.name": serviceName,
            "service.namespace": "careercoach",
            "deployment.environment.name": env.OTEL_DEPLOYMENT_ENVIRONMENT,
        }),
        traceExporter: new OTLPTraceExporter({ url: traceEndpoint }),
        instrumentations: [
            getNodeAutoInstrumentations({
                "@opentelemetry/instrumentation-mongodb": {
                    enhancedDatabaseReporting: false,
                },
            }),
        ],
    });

    sdk.start();
    console.info(`[OTEL] Tracing enabled service=${serviceName} endpoint=${traceEndpoint}`);
};

registerOpenTelemetry();
