import { AppError } from './app-error';

/**
 * Raised when the data layer cannot reach MongoDB. The repository converts raw
 * driver exceptions into this type so nothing driver-specific leaks upward (P5).
 */
export class DatabaseUnavailableError extends AppError {
  constructor(message = 'Database is unavailable', options: { cause?: unknown } = {}) {
    super('DATABASE_UNAVAILABLE', 503, message, { cause: options.cause });
  }
}
