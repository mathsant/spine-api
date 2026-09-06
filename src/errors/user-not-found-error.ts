import { AppError } from './app-error';

/**
 * Raised when a `userId` does not resolve to a user, OR resolves but is not visible to
 * the caller (e.g. `GET /users/:userId/activity` without an approved follow). Both cases
 * return the exact same response — never `403` — so a private profile's existence is not
 * leaked (P6). Forward-compatible with a future block feature.
 */
export class UserNotFoundError extends AppError {
  constructor(message = 'User not found') {
    super('USER_NOT_FOUND', 404, message);
  }
}
