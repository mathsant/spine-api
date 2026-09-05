import type { Clock } from '../../container/cradle';
import { CommentNestingTooDeepError, CommentNotFoundError } from '../../errors';
import type { CommentRepository } from '../../repositories/comments';
import type { ResolveVisibleActivity } from '../activities';
import type { CreateNotification } from '../notifications';
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
  createNotification: CreateNotification;
  clock: Clock;
}

/**
 * Comments on a feed item, optionally as a reply to a top-level comment of the same item
 * (RF-005 to RF-007, RF-010, RF-014). Notifies the item owner (`comment_on_content`) and, when
 * replying, the parent comment's author (`comment_reply`) — deduplicated to a single notification
 * when both are the same person (008, D3 of research.md).
 */
export const makeCreateComment =
  ({ commentRepository, resolveVisibleActivity, createNotification, clock }: CreateCommentDeps): CreateComment =>
  async ({ userId, activityId, text, parentCommentId }) => {
    const activity = await resolveVisibleActivity(activityId, userId);

    let parent = null;
    if (parentCommentId) {
      parent = await commentRepository.findById(parentCommentId);
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

    const base = {
      actorId: userId,
      activityId,
      commentId: record.id,
      readingSessionId: activity.readingSessionId,
      activityType: activity.type,
    };

    let notifyItemOwner = true;
    if (parent) {
      await createNotification({ ...base, recipientId: parent.authorId, type: 'comment_reply' });
      if (parent.authorId === activity.actorId) {
        notifyItemOwner = false;
      }
    }
    if (notifyItemOwner) {
      await createNotification({ ...base, recipientId: activity.actorId, type: 'comment_on_content' });
    }

    return toCommentDTO(record);
  };
