import { AppError } from './app-error';

/**
 * Raised when a `commentId` does not exist, exists but belongs to someone else (delete, RF-009),
 * or a `parentCommentId` does not exist / does not belong to the target activity (RF-007).
 */
export class CommentNotFoundError extends AppError {
  constructor(message = 'Comment not found') {
    super('COMMENT_NOT_FOUND', 404, message);
  }
}
