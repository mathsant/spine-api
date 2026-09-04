import { AppError } from './app-error';

/**
 * Raised on refresh when the token is unknown/forged, or belongs to a session that
 * was already revoked (logout, password change, reuse detection) (RF-027).
 */
export class InvalidRefreshTokenError extends AppError {
  constructor(message = 'Invalid refresh token') {
    super('INVALID_REFRESH_TOKEN', 401, message);
  }
}
