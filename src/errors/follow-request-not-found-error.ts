import { AppError } from './app-error';

/**
 * Raised when there is no pending follow request for the expected pair — either it never
 * existed, was already resolved, or doesn't belong to the caller (never `403`, D7).
 */
export class FollowRequestNotFoundError extends AppError {
  constructor(message = 'Follow request not found') {
    super('FOLLOW_REQUEST_NOT_FOUND', 404, message);
  }
}
