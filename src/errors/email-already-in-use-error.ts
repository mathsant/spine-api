import { AppError } from './app-error';

/** Raised on signup when the (normalised) email already belongs to an account. */
export class EmailAlreadyInUseError extends AppError {
  constructor(message = 'Email is already in use') {
    super('EMAIL_ALREADY_IN_USE', 409, message);
  }
}
