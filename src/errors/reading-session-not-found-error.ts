import { AppError } from './app-error';

/**
 * Raised when a `sessionId` does not exist, or exists but belongs to another user.
 * The two cases are intentionally indistinguishable to the caller (see plan.md D9) —
 * revealing that another user's session exists would leak private data (P6).
 */
export class ReadingSessionNotFoundError extends AppError {
  constructor(message = 'Reading session not found') {
    super('READING_SESSION_NOT_FOUND', 404, message);
  }
}
