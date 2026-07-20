import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import { OTLPTraceExporter as GrpcExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { OTLPTraceExporter as HttpExporter } from '@opentelemetry/exporter-trace-otlp-http';
import type { Instrumentation } from '@opentelemetry/instrumentation';
import { AmqplibInstrumentation } from '@opentelemetry/instrumentation-amqplib';
import { AwsInstrumentation } from '@opentelemetry/instrumentation-aws-sdk';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { MongoDBInstrumentation } from '@opentelemetry/instrumentation-mongodb';
import { RedisInstrumentation } from '@opentelemetry/instrumentation-redis-4';
import { RuntimeNodeInstrumentation } from '@opentelemetry/instrumentation-runtime-node';
import { NodeSDK } from '@opentelemetry/sdk-node';

diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.WARN);

const IS_HTTP = process.env.OTEL_EXPORTER_OTLP_PROTOCOL?.startsWith('http') ?? false;

const addShutdownHook = (sdk: NodeSDK): void => {
  const shutdown = (signal: string): void => {
    console.info(`Received ${signal}, shutting down telemetry...`);
    sdk
      .shutdown()
      .then((): null => {
        console.info('Telemetry shut down gracefully');
        return null;
      })
      .catch((err: unknown) => {
        console.error('Error shutting down telemetry', err);
      });
  };

  process.on('SIGTERM', () => {
    shutdown('SIGTERM');
  });
  process.on('SIGINT', () => {
    shutdown('SIGINT');
  });
};

const createTraceExporter = (isHttp: boolean) =>
  isHttp ? new HttpExporter() : new GrpcExporter();

const createInstrumentations = (): (Instrumentation | Instrumentation[])[] => [
  new HttpInstrumentation(),
  new AmqplibInstrumentation(),
  new AwsInstrumentation(),
  new RedisInstrumentation(),
  new MongoDBInstrumentation({
    enhancedDatabaseReporting: true,
  }),
  new RuntimeNodeInstrumentation({
    monitoringPrecision: 5000,
  }),
];

export const initOpenTelemetry = (): void => {
  if (!process.env.OTEL_EXPORTER_OTLP_ENDPOINT || !process.env.OTEL_SERVICE_NAME) {
    return;
  }

  const sdk = createNodeSDKInstance();
  sdk.start();
  addShutdownHook(sdk);
};

const createNodeSDKInstance = () =>
  new NodeSDK({
    instrumentations: createInstrumentations(),
    traceExporter: createTraceExporter(IS_HTTP),
  });
