import { AppError } from './app-error';

/**
 * Raised when login or change-password is given the wrong password (or an unknown
 * email). The message is intentionally generic and identical for every case so it
 * never reveals whether an account exists (RF-014, RF-034).
 */
export class InvalidCredentialsError extends AppError {
  constructor() {
    super('INVALID_CREDENTIALS', 401, 'Invalid email or password');
  }
}
