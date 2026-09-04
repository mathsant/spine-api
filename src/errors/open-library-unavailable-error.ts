import { AppError } from './app-error';

/** Raised on network error, timeout or a 5xx response from the Open Library API. */
export class OpenLibraryUnavailableError extends AppError {
  constructor(message = 'Open Library is unavailable') {
    super('OPEN_LIBRARY_UNAVAILABLE', 503, message);
  }
}
