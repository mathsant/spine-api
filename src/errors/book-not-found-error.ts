import { AppError } from './app-error';

/** Raised when an `olid` matches no cached Book and no Open Library work either. */
export class BookNotFoundError extends AppError {
  constructor(message = 'Book not found') {
    super('BOOK_NOT_FOUND', 404, message);
  }
}
