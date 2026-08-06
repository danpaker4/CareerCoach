import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const DEFAULT_SERVICE_NAME = "careercoach.evaluation-service";
const DEFAULT_OTLP_ENDPOINT = "http://127.0.0.1:4318";
const DEFAULT_OTLP_PROTOCOL = "http/protobuf";
const DEFAULT_DEPLOYMENT_ENVIRONMENT = "local";
const DEFAULT_TRACES_SAMPLER = "parentbased_traceidratio";
const DEFAULT_TRACES_SAMPLER_ARG = "1";

const optionalEmptyString = (value: unknown): unknown =>
    typeof value === "string" && value.trim().length === 0 ? undefined : value;

const booleanStringSchema = z.preprocess(
    (value: unknown): boolean => typeof value === "boolean" ? value : typeof value === "string" && value.toLowerCase() === "true",
    z.boolean()
);

const EnvSchema = z.object({
    OTEL_ENABLED: booleanStringSchema.default(false),
    OTEL_SERVICE_NAME: z.preprocess(optionalEmptyString, z.string().min(1).default(DEFAULT_SERVICE_NAME)),
    OTEL_EXPORTER_OTLP_ENDPOINT: z.preprocess(optionalEmptyString, z.string().url().default(DEFAULT_OTLP_ENDPOINT)),
    OTEL_EXPORTER_OTLP_PROTOCOL: z.preprocess(optionalEmptyString, z.string().min(1).default(DEFAULT_OTLP_PROTOCOL)),
    OTEL_DEPLOYMENT_ENVIRONMENT: z.preprocess(optionalEmptyString, z.string().min(1).default(DEFAULT_DEPLOYMENT_ENVIRONMENT)),
});

const env = EnvSchema.parse(process.env);

export const isOtelEnabled = env.OTEL_ENABLED;

// gal-observability reads these env vars when initOpenTelemetry() runs, and it
// picks the OTLP exporter protocol at module load time, so the defaults must be
// applied here, before the library module is evaluated.
if (isOtelEnabled) {
    process.env.OTEL_SERVICE_NAME = env.OTEL_SERVICE_NAME;
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = env.OTEL_EXPORTER_OTLP_ENDPOINT;
    process.env.OTEL_EXPORTER_OTLP_PROTOCOL = env.OTEL_EXPORTER_OTLP_PROTOCOL;
    process.env.OTEL_TRACES_SAMPLER ??= DEFAULT_TRACES_SAMPLER;
    process.env.OTEL_TRACES_SAMPLER_ARG ??= DEFAULT_TRACES_SAMPLER_ARG;
    process.env.OTEL_RESOURCE_ATTRIBUTES ??= `service.namespace=careercoach,deployment.environment.name=${env.OTEL_DEPLOYMENT_ENVIRONMENT}`;
}
