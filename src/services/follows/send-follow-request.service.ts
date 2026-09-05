import type { Clock } from '../../container/cradle';
import { AlreadyFollowingError, CannotFollowSelfError, NotFoundError } from '../../errors';
import type { FollowRequestRepository } from '../../repositories/follow-requests';
import type { FollowRepository } from '../../repositories/follows';
import type { UserRepository } from '../../repositories/users';
import type { CreateNotification } from '../notifications';
import type { FollowRequestCreationDTO } from './types';

export interface SendFollowRequestInput {
  requesterId: string;
  targetId: string;
}

export type SendFollowRequest = (
  input: SendFollowRequestInput,
) => Promise<{ request: FollowRequestCreationDTO; created: boolean }>;

export interface SendFollowRequestDeps {
  userRepository: UserRepository;
  followRepository: FollowRepository;
  followRequestRepository: FollowRequestRepository;
  createNotification: CreateNotification;
  clock: Clock;
}

/**
 * Sends a follow request (RF-005), idempotent when already pending (RF-008). Notifies the target
 * only when the request is genuinely new — a repeated pending request never duplicates the
 * notification (008, D1 of research.md).
 */
export const makeSendFollowRequest =
  ({
    userRepository,
    followRepository,
    followRequestRepository,
    createNotification,
    clock,
  }: SendFollowRequestDeps): SendFollowRequest =>
  async ({ requesterId, targetId }) => {
    if (requesterId === targetId) {
      throw new CannotFollowSelfError();
    }

    const target = await userRepository.findById(targetId);
    if (!target) {
      throw new NotFoundError('User not found');
    }

    if (await followRepository.exists(requesterId, targetId)) {
      throw new AlreadyFollowingError();
    }

    const existing = await followRequestRepository.findByPair(requesterId, targetId);
    const record = existing ?? (await followRequestRepository.create(requesterId, targetId, clock.now()));

    if (!existing) {
      await createNotification({ recipientId: targetId, actorId: requesterId, type: 'follow_request' });
    }

    return {
      request: {
        requesterId: record.requesterId,
        targetId: record.targetId,
        createdAt: record.createdAt.toISOString(),
      },
      created: !existing,
    };
  };
