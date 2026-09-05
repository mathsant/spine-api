import { FollowRequestNotFoundError } from '../../errors';
import type { FollowRequestRepository } from '../../repositories/follow-requests';
import type { NotificationRepository } from '../../repositories/notifications';

export interface RejectFollowRequestInput {
  targetId: string;
  requesterId: string;
}

export type RejectFollowRequest = (input: RejectFollowRequestInput) => Promise<void>;

export interface RejectFollowRequestDeps {
  followRequestRepository: FollowRequestRepository;
  notificationRepository: NotificationRepository;
}

/**
 * Rejects a pending follow request received by me — deleted, no history kept (RF-012/RF-013).
 * Removes the pending `follow_request` notification; never notifies the requester of the
 * rejection (008, RF-003, D2 of research.md).
 */
export const makeRejectFollowRequest =
  ({ followRequestRepository, notificationRepository }: RejectFollowRequestDeps): RejectFollowRequest =>
  async ({ targetId, requesterId }) => {
    const deleted = await followRequestRepository.deleteByPair(requesterId, targetId);
    if (!deleted) {
      throw new FollowRequestNotFoundError();
    }

    await notificationRepository.deleteFollowRequestNotification(targetId, requesterId);
  };
