export interface AppErrorOptions {
  /** Structured context safe to expose to the client (e.g. validation issues). */
  details?: unknown;
  /** Underlying error, kept for logging only. */
  cause?: unknown;
}

/**
 * Base type for every expected/operational error in the application.
 * The HTTP error handler maps `instanceof AppError` to a response; anything
 * else becomes a generic 500.
 */
export abstract class AppError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly details?: unknown;
  readonly isOperational = true;

  protected constructor(
    code: string,
    statusCode: number,
    message: string,
    options: AppErrorOptions = {},
  ) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = new.target.name;
    this.code = code;
    this.statusCode = statusCode;
    this.details = options.details;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, new.target);
    }
  }
}
