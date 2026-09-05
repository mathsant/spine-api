import type { CommentRecord } from '../../repositories/comments';
import type { CommentDTO } from './types';

const REMOVED_PLACEHOLDER = '[removido]';

/** The persisted `text` is never exposed once soft-deleted — a fixed placeholder replaces it (RF-009). */
export function toCommentDTO(comment: CommentRecord): CommentDTO {
  const deleted = comment.deletedAt !== null;

  return {
    id: comment.id,
    activityId: comment.activityId,
    authorId: comment.authorId,
    text: deleted ? REMOVED_PLACEHOLDER : comment.text,
    parentCommentId: comment.parentCommentId,
    deleted,
    createdAt: comment.createdAt.toISOString(),
  };
}
