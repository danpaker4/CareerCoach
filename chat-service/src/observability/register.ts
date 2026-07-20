import { isOtelEnabled, serviceName } from "./register-env";
import { initOpenTelemetry } from "gal-observability/open-telemetry";

if (isOtelEnabled) {
    initOpenTelemetry();
    console.info(`[OTEL] Tracing enabled via gal-observability service=${serviceName} endpoint=${process.env.OTEL_EXPORTER_OTLP_ENDPOINT}`);
}
