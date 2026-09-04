import { AppError } from './app-error';

/** Raised on signup when the (normalised) handle already belongs to an account. */
export class HandleAlreadyInUseError extends AppError {
  constructor(message = 'Handle is already in use') {
    super('HANDLE_ALREADY_IN_USE', 409, message);
  }
}
