import {
  context,
  type Span,
  SpanStatusCode,
  trace,
} from '@opentelemetry/api';

const toError = (err: unknown): Error =>
  err instanceof Error ? err : new Error(String(err));

export const addCustomSpan = <T>(
  spanName: string,
  callback: (span: Span) => Promise<T>,
): Promise<T> => {
  const tracer = trace.getTracer('z-obs-tracer');

  return tracer.startActiveSpan(spanName, async (span) => {
    try {
      return await callback(span);
    } catch (err: unknown) {
      const error = toError(err);
      span.recordException(error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      throw error;
    } finally {
      span.end();
    }
  });
};

export const isSampled = (): boolean => {
  const span = trace.getActiveSpan();
  return span ? span.isRecording() : true;
};

export const pyroscopeMiddleware = (
  _req: unknown,
  _res: unknown,
  next: () => void,
): void => {
  const span = trace.getSpan(context.active());
  if (!span) {
    next();
    return;
  }

  next();
};
