import { AppError } from './app-error';

/** Raised when a progress update targets a reading session that is not `reading`. */
export class InvalidReadingSessionStateError extends AppError {
  constructor(message = 'Reading session is not in the reading state') {
    super('INVALID_READING_SESSION_STATE', 409, message);
  }
}
