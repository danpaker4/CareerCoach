import type { FastifyReply, FastifyRequest } from 'fastify';

type Values<T> = T[keyof T];

export const LOG_PHASE = {
  STARTED: 'STARTED',
  SUCCESS: 'SUCCESS',
  ERROR: 'ERROR',
} as const;

export type RouteLogConfig = {
  selectFields?: (ctx: LogSelectingContext) => Record<string, unknown>;
  logStarted?: boolean;
  logSuccess?: boolean;
  logHttp?: boolean;
  message?: string;
};

export type httpLoggingOptions = {
  enableByDefault?: boolean;
  logStarted?: boolean;
  logSuccess?: boolean;
  enableProfiling?: boolean;
};

export type LogSelectingContext = {
  reply?: FastifyReply;
  req?: FastifyRequest;
  durationMs?: number;
  payload?: unknown;
  phase?: LogPhase;
  error?: Error;
};

export type RequestWithMeta = {
  hasLoggedError?: boolean;
  _logStartTime?: bigint;
  _logSampled?: boolean;
} & FastifyRequest;

export type LogPhase = Values<typeof LOG_PHASE>;
