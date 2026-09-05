import type { Clock } from '../../container/cradle';
import { CommentNotFoundError } from '../../errors';
import type { CommentRepository } from '../../repositories/comments';

export interface DeleteCommentInput {
  userId: string;
  commentId: string;
}

export type DeleteComment = (input: DeleteCommentInput) => Promise<void>;

export interface DeleteCommentDeps {
  commentRepository: CommentRepository;
  clock: Clock;
}

/**
 * Soft-deletes the caller's own comment (RF-009). No visibility re-check against the target
 * activity — deleting one's own content stays possible even if access to the item was lost
 * later (007, D6 of research.md).
 */
export const makeDeleteComment =
  ({ commentRepository, clock }: DeleteCommentDeps): DeleteComment =>
  async ({ userId, commentId }) => {
    const existing = await commentRepository.findById(commentId);
    if (!existing || existing.authorId !== userId) {
      throw new CommentNotFoundError();
    }

    await commentRepository.softDelete(commentId, clock.now());
  };
