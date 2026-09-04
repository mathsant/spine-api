import { FollowRequestNotFoundError } from '../../errors';
import type { FollowRequestRepository } from '../../repositories/follow-requests';

export interface RejectFollowRequestInput {
  targetId: string;
  requesterId: string;
}

export type RejectFollowRequest = (input: RejectFollowRequestInput) => Promise<void>;

export interface RejectFollowRequestDeps {
  followRequestRepository: FollowRequestRepository;
}

/** Rejects a pending follow request received by me — deleted, no history kept (RF-012/RF-013). */
export const makeRejectFollowRequest =
  ({ followRequestRepository }: RejectFollowRequestDeps): RejectFollowRequest =>
  async ({ targetId, requesterId }) => {
    const deleted = await followRequestRepository.deleteByPair(requesterId, targetId);
    if (!deleted) {
      throw new FollowRequestNotFoundError();
    }
  };
