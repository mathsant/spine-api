import { AppError } from './app-error';

/**
 * Raised when there is no approved follow relation for the expected pair — either it never
 * existed or doesn't belong to the caller (never `403`, D7).
 */
export class FollowNotFoundError extends AppError {
  constructor(message = 'Follow relation not found') {
    super('FOLLOW_NOT_FOUND', 404, message);
  }
}
