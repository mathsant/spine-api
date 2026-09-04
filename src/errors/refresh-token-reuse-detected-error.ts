import { AppError } from './app-error';

/**
 * Raised on refresh when an already-rotated token link is presented again (replay or
 * race). The whole session is revoked as a side effect before this is thrown (RF-026).
 */
export class RefreshTokenReuseDetectedError extends AppError {
  constructor(message = 'Refresh token reuse detected; the session has been revoked') {
    super('REFRESH_TOKEN_REUSE_DETECTED', 401, message);
  }
}
