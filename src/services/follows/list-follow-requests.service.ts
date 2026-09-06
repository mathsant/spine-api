import type { FollowRequestRecord, FollowRequestRepository } from '../../repositories/follow-requests';
import type { FollowRepository } from '../../repositories/follows';
import type { UserRepository } from '../../repositories/users';
import { resolveRelationships } from './resolve-relationships';
import type { FollowRequestCursorPageDTO } from './types';

export interface ListFollowRequestsInput {
  userId: string;
  direction: 'incoming' | 'outgoing';
  cursor: string | null;
  limit: number;
}

export type ListFollowRequests = (input: ListFollowRequestsInput) => Promise<FollowRequestCursorPageDTO>;

export interface ListFollowRequestsDeps {
  followRequestRepository: FollowRequestRepository;
  followRepository: FollowRepository;
  userRepository: UserRepository;
}

/** Lists my pending follow requests, received or sent. Each item carries
 * `followState`/`followsYou` relative to me (011 — D4), resolved in one batch. */
export const makeListFollowRequests =
  ({
    followRequestRepository,
    followRepository,
    userRepository,
  }: ListFollowRequestsDeps): ListFollowRequests =>
  async ({ userId, direction, cursor, limit }) => {
    const page =
      direction === 'incoming'
        ? await followRequestRepository.listByTarget(userId, cursor, limit)
        : await followRequestRepository.listByRequester(userId, cursor, limit);

    const otherSideId = (record: FollowRequestRecord): string =>
      direction === 'incoming' ? record.requesterId : record.targetId;
    const otherSideIds = page.items.map(otherSideId);

    const [otherSides, relationships] = await Promise.all([
      Promise.all(otherSideIds.map((id) => userRepository.findById(id))),
      resolveRelationships(userId, otherSideIds, { followRepository, followRequestRepository }),
    ]);

    return {
      items: page.items.map((record, index) => {
        const otherSide = otherSides[index];
        const id = otherSideId(record);
        const relationship = relationships.get(id) ?? {
          followState: 'none' as const,
          followsYou: false,
        };
        return {
          userId: id,
          handle: otherSide?.handle ?? '',
          displayName: otherSide?.displayName ?? '',
          direction,
          createdAt: record.createdAt.toISOString(),
          followState: relationship.followState,
          followsYou: relationship.followsYou,
        };
      }),
      nextCursor: page.nextCursor,
    };
  };
