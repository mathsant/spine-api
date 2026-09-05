import { AppError } from './app-error';

/** Raised when a `notificationId` does not exist, or exists but belongs to someone else (RF-012, RF-013). */
export class NotificationNotFoundError extends AppError {
  constructor(message = 'Notification not found') {
    super('NOTIFICATION_NOT_FOUND', 404, message);
  }
}
