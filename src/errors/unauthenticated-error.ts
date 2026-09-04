import { AppError } from './app-error';

/**
 * Raised on a protected route when the request carries no usable `Authorization`
 * header (absent, scheme other than `Bearer`, or `Bearer` with an empty value).
 */
export class UnauthenticatedError extends AppError {
  constructor(message = 'Authentication required') {
    super('UNAUTHENTICATED', 401, message);
  }
}
