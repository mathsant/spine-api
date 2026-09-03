import type { FastifyBaseLogger } from 'fastify';

interface ShutdownApp {
  close: () => Promise<void>;
  log: Pick<FastifyBaseLogger, 'info' | 'warn' | 'error'>;
}

export interface ShutdownOptions {
  /** Force-exit if `app.close()` has not finished within this window. */
  timeoutMs?: number;
  signals?: NodeJS.Signals[];
  /** Injected for tests; defaults to `process.exit`. */
  exit?: (code: number) => void;
}

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_SIGNALS: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];

/**
 * Registers SIGTERM/SIGINT handlers that close the app once (drains in-flight
 * requests, fires Awilix disposers -> closes MongoDB), then exit. A repeated
 * signal while shutting down is ignored. Returns a function that removes the
 * listeners.
 */
export function registerShutdownHandlers(
  app: ShutdownApp,
  options: ShutdownOptions = {},
): () => void {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const signals = options.signals ?? DEFAULT_SIGNALS;
  const exit = options.exit ?? ((code: number) => process.exit(code));

  let shuttingDown = false;

  const handle = (signal: NodeJS.Signals): void => {
    if (shuttingDown) {
      app.log.warn({ signal }, 'shutdown already in progress; ignoring signal');
      return;
    }
    shuttingDown = true;
    app.log.info({ signal }, 'graceful shutdown started');

    const forced = setTimeout(() => {
      app.log.error('graceful shutdown timed out; forcing exit');
      exit(1);
    }, timeoutMs);
    forced.unref();

    app.close().then(
      () => {
        clearTimeout(forced);
        app.log.info('graceful shutdown complete');
        exit(0);
      },
      (error: unknown) => {
        clearTimeout(forced);
        app.log.error({ err: error }, 'error during graceful shutdown');
        exit(1);
      },
    );
  };

  const listeners = signals.map((signal) => {
    const listener = (): void => {
      handle(signal);
    };
    process.on(signal, listener);
    return [signal, listener] as const;
  });

  return () => {
    for (const [signal, listener] of listeners) {
      process.removeListener(signal, listener);
    }
  };
}
