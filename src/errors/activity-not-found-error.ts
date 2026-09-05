import { AppError } from './app-error';

/**
 * Raised when an `activityId` does not exist, or exists but the viewer is neither its owner
 * nor an approved follower of the owner (RF-012, RF-015). Both cases share this error/status so
 * the response never reveals which one it is (P6).
 */
export class ActivityNotFoundError extends AppError {
  constructor(message = 'Activity not found') {
    super('ACTIVITY_NOT_FOUND', 404, message);
  }
}
