import { env, hasLangfuseKeys, serviceName } from "./register-env";
import { initOpenTelemetry } from "gal-observability/open-telemetry";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { LangfuseSpanProcessor } from "@langfuse/otel";

const OTLP_TRACES_PATH = "/v1/traces";
const AMQPLIB_CONSUME_TIMEOUT_MS = 5 * 60 * 1000;

const trimTrailingSlashes = (value: string): string => value.replace(/\/+$/, "");

const resolveTraceEndpoint = (otlpEndpoint: string, traceEndpoint?: string): string =>
    traceEndpoint ?? `${trimTrailingSlashes(otlpEndpoint)}${OTLP_TRACES_PATH}`;

// Langfuse requires a custom span processor on the SDK, which gal-observability
// does not expose, so this path keeps a hand-rolled NodeSDK.
const registerWithLangfuse = (): void => {
    const spanProcessors = [];

    if (env.OTEL_ENABLED) {
        const traceEndpoint = resolveTraceEndpoint(env.OTEL_EXPORTER_OTLP_ENDPOINT, env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT);
        spanProcessors.push(new BatchSpanProcessor(new OTLPTraceExporter({ url: traceEndpoint })));
        console.info(`[OTEL] Tracing enabled service=${serviceName} endpoint=${traceEndpoint}`);
    }

    spanProcessors.push(new LangfuseSpanProcessor({
        publicKey: env.LANGFUSE_PUBLIC_KEY,
        secretKey: env.LANGFUSE_SECRET_KEY,
        baseUrl: env.LANGFUSE_BASE_URL,
        environment: env.OTEL_DEPLOYMENT_ENVIRONMENT,
    }));
    console.info(`[Langfuse] Tracing enabled service=${serviceName} baseUrl=${env.LANGFUSE_BASE_URL}`);

    const sdk = new NodeSDK({
        resource: resourceFromAttributes({
            "service.name": serviceName,
            "service.namespace": "careercoach",
            "deployment.environment.name": env.OTEL_DEPLOYMENT_ENVIRONMENT,
        }),
        spanProcessors,
        instrumentations: env.OTEL_ENABLED
            ? [
                getNodeAutoInstrumentations({
                    "@opentelemetry/instrumentation-amqplib": {
                        consumeTimeoutMs: AMQPLIB_CONSUME_TIMEOUT_MS,
                        useLinksForConsume: false,
                    },
                    "@opentelemetry/instrumentation-mongodb": {
                        enhancedDatabaseReporting: false,
                    },
                }),
            ]
            : [],
    });

    sdk.start();
};

if (hasLangfuseKeys) {
    registerWithLangfuse();
} else if (env.OTEL_ENABLED) {
    initOpenTelemetry();
    console.info(`[OTEL] Tracing enabled via gal-observability service=${serviceName} endpoint=${env.OTEL_EXPORTER_OTLP_ENDPOINT}`);
}
