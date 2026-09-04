import { AppError } from './app-error';

/** Raised when a `reviewId` doesn't exist or belongs to another user (D7/D9). */
export class ReviewNotFoundError extends AppError {
  constructor(message = 'Review not found') {
    super('REVIEW_NOT_FOUND', 404, message);
  }
}
