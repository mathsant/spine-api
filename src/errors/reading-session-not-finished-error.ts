import { AppError } from './app-error';

/** Raised when a review is created for a reading session that is not `finished` (RF-002). */
export class ReadingSessionNotFinishedError extends AppError {
  constructor(message = 'Reading session is not finished') {
    super('READING_SESSION_NOT_FINISHED', 409, message);
  }
}
