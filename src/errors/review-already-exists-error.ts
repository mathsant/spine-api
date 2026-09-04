import { AppError } from './app-error';

/** Raised when a reading session that already has a review gets a second one (RF-003). */
export class ReviewAlreadyExistsError extends AppError {
  constructor(message = 'Review already exists for this reading session') {
    super('REVIEW_ALREADY_EXISTS', 409, message);
  }
}
