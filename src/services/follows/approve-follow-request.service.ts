import type { Clock } from '../../container/cradle';
import { FollowRequestNotFoundError } from '../../errors';
import type { FollowRequestRepository } from '../../repositories/follow-requests';
import type { FollowRepository } from '../../repositories/follows';
import type { NotificationRepository } from '../../repositories/notifications';
import type { CreateNotification } from '../notifications';

export interface ApproveFollowRequestInput {
  targetId: string;
  requesterId: string;
}

export type ApproveFollowRequest = (input: ApproveFollowRequestInput) => Promise<void>;

export interface ApproveFollowRequestDeps {
  followRequestRepository: FollowRequestRepository;
  followRepository: FollowRepository;
  notificationRepository: NotificationRepository;
  createNotification: CreateNotification;
  clock: Clock;
}

/**
 * Approves a pending follow request received by me: creates the directional relation
 * (requester -> target) and deletes the request (RF-010). Never creates the reverse
 * relation (RF-011, P13). Removes the pending `follow_request` notification and notifies the
 * requester with `follow_approved` (008, RF-002/RF-004, D2 of research.md).
 */
export const makeApproveFollowRequest =
  ({
    followRequestRepository,
    followRepository,
    notificationRepository,
    createNotification,
    clock,
  }: ApproveFollowRequestDeps): ApproveFollowRequest =>
  async ({ targetId, requesterId }) => {
    const deleted = await followRequestRepository.deleteByPair(requesterId, targetId);
    if (!deleted) {
      throw new FollowRequestNotFoundError();
    }

    await followRepository.create(requesterId, targetId, clock.now());
    await notificationRepository.deleteFollowRequestNotification(targetId, requesterId);
    await createNotification({ recipientId: requesterId, actorId: targetId, type: 'follow_approved' });
  };
