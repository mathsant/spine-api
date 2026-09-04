import { AppError } from './app-error';

/**
 * Raised when an access token is present but unusable: bad signature, wrong `alg`,
 * malformed, expired, or the referenced account no longer exists (RF-016, RF-018).
 */
export class InvalidAccessTokenError extends AppError {
  constructor(message = 'Invalid or expired access token') {
    super('INVALID_ACCESS_TOKEN', 401, message);
  }
}
