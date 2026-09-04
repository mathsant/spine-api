import type { Clock } from '../../container/cradle';
import { FollowRequestNotFoundError } from '../../errors';
import type { FollowRequestRepository } from '../../repositories/follow-requests';
import type { FollowRepository } from '../../repositories/follows';

export interface ApproveFollowRequestInput {
  targetId: string;
  requesterId: string;
}

export type ApproveFollowRequest = (input: ApproveFollowRequestInput) => Promise<void>;

export interface ApproveFollowRequestDeps {
  followRequestRepository: FollowRequestRepository;
  followRepository: FollowRepository;
  clock: Clock;
}

/**
 * Approves a pending follow request received by me: creates the directional relation
 * (requester -> target) and deletes the request (RF-010). Never creates the reverse
 * relation (RF-011, P13).
 */
export const makeApproveFollowRequest =
  ({ followRequestRepository, followRepository, clock }: ApproveFollowRequestDeps): ApproveFollowRequest =>
  async ({ targetId, requesterId }) => {
    const deleted = await followRequestRepository.deleteByPair(requesterId, targetId);
    if (!deleted) {
      throw new FollowRequestNotFoundError();
    }

    await followRepository.create(requesterId, targetId, clock.now());
  };
