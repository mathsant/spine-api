import { FollowRequestNotFoundError } from '../../errors';
import type { FollowRequestRepository } from '../../repositories/follow-requests';

export interface CancelFollowRequestInput {
  requesterId: string;
  targetId: string;
}

export type CancelFollowRequest = (input: CancelFollowRequestInput) => Promise<void>;

export interface CancelFollowRequestDeps {
  followRequestRepository: FollowRequestRepository;
}

/** Cancels a pending follow request I sent (RF-009). */
export const makeCancelFollowRequest =
  ({ followRequestRepository }: CancelFollowRequestDeps): CancelFollowRequest =>
  async ({ requesterId, targetId }) => {
    const deleted = await followRequestRepository.deleteByPair(requesterId, targetId);
    if (!deleted) {
      throw new FollowRequestNotFoundError();
    }
  };
