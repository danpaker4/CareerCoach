import { isOtelEnabled, langfuseObservabilityConfig, serviceName } from "./register-env";
import { initOpenTelemetry } from "gal-observability/open-telemetry";

if (isOtelEnabled) {
    initOpenTelemetry();
    console.info(JSON.stringify({
        event: "observability.startup",
        tracingEnabled: true,
        serviceName,
        otlpEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
        deploymentEnvironment: process.env.OTEL_DEPLOYMENT_ENVIRONMENT ?? "local",
        langfuseContentCapture: langfuseObservabilityConfig.captureContent,
        langfuseContentMaxChars: langfuseObservabilityConfig.contentMaxChars,
    }));
    if (!langfuseObservabilityConfig.captureContent) {
        console.warn(JSON.stringify({
            event: "observability.content_capture_disabled",
            message: "Langfuse observation input and output are omitted. Set LANGFUSE_CAPTURE_CONTENT=true to capture redacted content.",
        }));
    }
}
