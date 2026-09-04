import { AppError } from './app-error';

/** Raised when a user sends a follow request targeting their own id (RF-006). */
export class CannotFollowSelfError extends AppError {
  constructor(message = 'Cannot follow yourself') {
    super('CANNOT_FOLLOW_SELF', 422, message);
  }
}
