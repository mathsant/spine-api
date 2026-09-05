import type { CommentRepository } from '../../repositories/comments';
import type { ResolveVisibleActivity } from '../activities';
import { toCommentDTO } from './to-dto';
import type { CommentCursorPageDTO } from './types';

export interface ListCommentsInput {
  userId: string;
  activityId: string;
  cursor: string | null;
  limit: number;
}

export type ListComments = (input: ListCommentsInput) => Promise<CommentCursorPageDTO>;

export interface ListCommentsDeps {
  commentRepository: CommentRepository;
  resolveVisibleActivity: ResolveVisibleActivity;
}

/** Lists the comments of a feed item, ascending chronological order, paginated by cursor (RF-008). */
export const makeListComments =
  ({ commentRepository, resolveVisibleActivity }: ListCommentsDeps): ListComments =>
  async ({ userId, activityId, cursor, limit }) => {
    await resolveVisibleActivity(activityId, userId);

    const page = await commentRepository.listByActivity(activityId, cursor, limit);

    return {
      items: page.items.map(toCommentDTO),
      nextCursor: page.nextCursor,
    };
  };
