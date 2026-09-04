import type { FollowRequestRecord, FollowRequestRepository } from '../../repositories/follow-requests';
import type { UserRepository } from '../../repositories/users';
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
  userRepository: UserRepository;
}

/** Lists my pending follow requests, received or sent (cenário 4 da spec; D6 do research.md). */
export const makeListFollowRequests =
  ({ followRequestRepository, userRepository }: ListFollowRequestsDeps): ListFollowRequests =>
  async ({ userId, direction, cursor, limit }) => {
    const page =
      direction === 'incoming'
        ? await followRequestRepository.listByTarget(userId, cursor, limit)
        : await followRequestRepository.listByRequester(userId, cursor, limit);

    const otherSideId = (record: FollowRequestRecord): string =>
      direction === 'incoming' ? record.requesterId : record.targetId;

    const otherSides = await Promise.all(page.items.map((record) => userRepository.findById(otherSideId(record))));

    return {
      items: page.items.map((record, index) => {
        const otherSide = otherSides[index];
        return {
          userId: otherSideId(record),
          handle: otherSide?.handle ?? '',
          displayName: otherSide?.displayName ?? '',
          direction,
          createdAt: record.createdAt.toISOString(),
        };
      }),
      nextCursor: page.nextCursor,
    };
  };
