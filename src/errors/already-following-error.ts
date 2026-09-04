import { AppError } from './app-error';

/** Raised when a new follow request targets someone the requester already follows (RF-007). */
export class AlreadyFollowingError extends AppError {
  constructor(message = 'Already following this user') {
    super('ALREADY_FOLLOWING', 409, message);
  }
}
