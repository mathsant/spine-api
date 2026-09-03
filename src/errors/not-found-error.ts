import { AppError } from './app-error';

/** Raised when a requested resource does not exist. Base for the next features. */
export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', details?: unknown) {
    super('NOT_FOUND', 404, message, { details });
  }
}
