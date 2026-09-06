import { UserNotFoundError } from '../../errors';
import type { FollowRequestRepository } from '../../repositories/follow-requests';
import type { FollowRepository } from '../../repositories/follows';
import type { UserRepository } from '../../repositories/users';
import { resolveRelationships } from '../follows';
import type { UserProfileDTO } from './types';

export interface GetUserProfileInput {
  viewerId: string;
  userId: string;
}

export type GetUserProfile = (input: GetUserProfileInput) => Promise<UserProfileDTO>;

export interface GetUserProfileDeps {
  userRepository: UserRepository;
  followRepository: FollowRepository;
  followRequestRepository: FollowRequestRepository;
}

/**
 * Profile of a single person (011 — D1). `id`/`handle`/`displayName`/`avatarUrl` always;
 * `bio` only for an approved follower (P6). A nonexistent or malformed `userId` — and, by
 * construction, anything not visible — is a neutral `UserNotFoundError` (never `403`).
 */
export const makeGetUserProfile =
  ({
    userRepository,
    followRepository,
    followRequestRepository,
  }: GetUserProfileDeps): GetUserProfile =>
  async ({ viewerId, userId }) => {
    const target = await userRepository.findById(userId);
    if (!target) {
      throw new UserNotFoundError();
    }

    if (target.id === viewerId) {
      return {
        id: target.id,
        handle: target.handle,
        displayName: target.displayName,
        avatarUrl: null,
        bio: null,
        followState: 'none',
        followsYou: false,
      };
    }

    const relationships = await resolveRelationships(viewerId, [target.id], {
      followRepository,
      followRequestRepository,
    });
    const { followState, followsYou } = relationships.get(target.id) ?? {
      followState: 'none',
      followsYou: false,
    };

    return {
      id: target.id,
      handle: target.handle,
      displayName: target.displayName,
      avatarUrl: null,
      bio: followState === 'following' ? target.bio : null,
      followState,
      followsYou,
    };
  };
