import { AppError } from './app-error';

/** Raised when `parentCommentId` points to a reply, not a top-level comment (RF-010). */
export class CommentNestingTooDeepError extends AppError {
  constructor(message = 'Cannot reply to a reply — nesting is limited to 1 level') {
    super('COMMENT_NESTING_TOO_DEEP', 422, message);
  }
}
