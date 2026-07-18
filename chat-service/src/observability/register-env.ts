import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const DEFAULT_OTLP_ENDPOINT = "http://127.0.0.1:4318";
const DEFAULT_OTLP_PROTOCOL = "http/protobuf";
const DEFAULT_DEPLOYMENT_ENVIRONMENT = "local";
const DEFAULT_LANGFUSE_BASE_URL = "http://127.0.0.1:3100";
const CHAT_API_SERVICE_NAME = "careercoach.chat-api";
const CHAT_WORKER_SERVICE_NAME = "careercoach.chat-worker";

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
    OTEL_EXPORTER_OTLP_PROTOCOL: z.preprocess(optionalEmptyString, z.string().min(1).default(DEFAULT_OTLP_PROTOCOL)),
    OTEL_DEPLOYMENT_ENVIRONMENT: z.preprocess(
        optionalEmptyString,
        z.string().min(1).default(DEFAULT_DEPLOYMENT_ENVIRONMENT)
    ),
    OTEL_TRACES_SAMPLER: z
        .enum(["always_on", "always_off", "traceidratio", "parentbased_always_on", "parentbased_always_off", "parentbased_traceidratio"])
        .default("parentbased_traceidratio"),
    OTEL_TRACES_SAMPLER_ARG: z.preprocess(optionalEmptyString, z.coerce.number().min(0).max(1).default(1)),
    LANGFUSE_PUBLIC_KEY: z.preprocess(optionalEmptyString, z.string().min(1).optional()),
    LANGFUSE_SECRET_KEY: z.preprocess(optionalEmptyString, z.string().min(1).optional()),
    LANGFUSE_BASE_URL: z.preprocess(optionalEmptyString, z.string().url().default(DEFAULT_LANGFUSE_BASE_URL)),
});

const resolveDefaultServiceName = (): string =>
    process.argv.some((item) => item.includes("chat-worker")) ? CHAT_WORKER_SERVICE_NAME : CHAT_API_SERVICE_NAME;

export const env = EnvSchema.parse(process.env);
export const serviceName = env.OTEL_SERVICE_NAME ?? resolveDefaultServiceName();
export const hasLangfuseKeys = Boolean(env.LANGFUSE_PUBLIC_KEY && env.LANGFUSE_SECRET_KEY);

// gal-observability and the NodeSDK read these env vars, and the library picks
// the OTLP exporter protocol at module load time, so the defaults must be
// applied here, before the library module is evaluated.
if (env.OTEL_ENABLED) {
    process.env.OTEL_SERVICE_NAME = serviceName;
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = env.OTEL_EXPORTER_OTLP_ENDPOINT;
    process.env.OTEL_EXPORTER_OTLP_PROTOCOL = env.OTEL_EXPORTER_OTLP_PROTOCOL;
    process.env.OTEL_TRACES_SAMPLER = env.OTEL_TRACES_SAMPLER;
    process.env.OTEL_TRACES_SAMPLER_ARG = String(env.OTEL_TRACES_SAMPLER_ARG);
    process.env.OTEL_RESOURCE_ATTRIBUTES ??= `service.namespace=careercoach,deployment.environment.name=${env.OTEL_DEPLOYMENT_ENVIRONMENT}`;
}
