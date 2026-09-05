import type { Clock } from '../../container/cradle';
import { CommentNestingTooDeepError, CommentNotFoundError } from '../../errors';
import type { CommentRepository } from '../../repositories/comments';
import type { ResolveVisibleActivity } from '../activities';
import { toCommentDTO } from './to-dto';
import type { CommentDTO } from './types';

export interface CreateCommentInput {
  userId: string;
  activityId: string;
  text: string;
  parentCommentId?: string | null;
}

export type CreateComment = (input: CreateCommentInput) => Promise<CommentDTO>;

export interface CreateCommentDeps {
  commentRepository: CommentRepository;
  resolveVisibleActivity: ResolveVisibleActivity;
  clock: Clock;
}

/**
 * Comments on a feed item, optionally as a reply to a top-level comment of the same item
 * (RF-005 to RF-007, RF-010, RF-014).
 */
export const makeCreateComment =
  ({ commentRepository, resolveVisibleActivity, clock }: CreateCommentDeps): CreateComment =>
  async ({ userId, activityId, text, parentCommentId }) => {
    const activity = await resolveVisibleActivity(activityId, userId);

    if (parentCommentId) {
      const parent = await commentRepository.findById(parentCommentId);
      if (!parent || parent.activityId !== activityId) {
        throw new CommentNotFoundError();
      }
      if (parent.parentCommentId !== null) {
        throw new CommentNestingTooDeepError();
      }
    }

    const record = await commentRepository.create(
      {
        activityId,
        readingSessionId: activity.readingSessionId,
        activityType: activity.type,
        authorId: userId,
        text,
        parentCommentId: parentCommentId ?? null,
      },
      clock.now(),
    );

    return toCommentDTO(record);
  };
