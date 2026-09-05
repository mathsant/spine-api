import { AppError } from './app-error';

/** Raised when a comment/reaction targets a `started_reading` activity (RF-011, out of scope). */
export class UnsupportedActivityInteractionError extends AppError {
  constructor(message = 'This activity type does not support comments or reactions') {
    super('UNSUPPORTED_ACTIVITY_INTERACTION', 422, message);
  }
}
