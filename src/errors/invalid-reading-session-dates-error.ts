import { AppError } from './app-error';

/** Raised when an edit would leave a reading session with `finishedAt` before `startedAt`. */
export class InvalidReadingSessionDatesError extends AppError {
  constructor(message = 'finishedAt cannot be before startedAt') {
    super('INVALID_READING_SESSION_DATES', 422, message);
  }
}
