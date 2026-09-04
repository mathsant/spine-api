import { AppError } from './app-error';

/** Raised on refresh when the session has been inactive past the 30-day window (RF-025). */
export class RefreshTokenExpiredError extends AppError {
  constructor(message = 'Refresh token has expired') {
    super('REFRESH_TOKEN_EXPIRED', 401, message);
  }
}
