import { AppError } from './app-error';

/** Raised when removing a reaction the user never gave (RF-003). */
export class ReactionNotFoundError extends AppError {
  constructor(message = 'Reaction not found') {
    super('REACTION_NOT_FOUND', 404, message);
  }
}
