type LogContext = Record<string, unknown>;

export const Logs = {
  logInfo: (message: string, context: LogContext = {}): void => {
    console.log(`[INFO] ${message}`, context);
  },

  logError: (message: string, error: Error, context: LogContext = {}): void => {
    console.error(`[ERROR] ${message}`, { error: error.message, stack: error.stack, ...context });
  },
};

export const toError = (e: unknown): Error => {
  if (e instanceof Error) {
    return e;
  }
  return new Error(String(e));
};

