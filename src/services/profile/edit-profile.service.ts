import type { Clock } from '../../container/cradle';
import type { UpdateProfileInput, UserRepository } from '../../repositories/users';
import type { ProfileDTO } from './types';

export interface EditProfileInput {
  userId: string;
  displayName?: string;
  bio?: string | null;
}

export type EditProfile = (input: EditProfileInput) => Promise<ProfileDTO>;

export interface EditProfileDeps {
  userRepository: UserRepository;
  clock: Clock;
}

/** Edits displayName and/or bio of the caller's own profile (RF-002). `handle` is never accepted. */
export const makeEditProfile =
  ({ userRepository, clock }: EditProfileDeps): EditProfile =>
  async ({ userId, displayName, bio }) => {
    const patch: UpdateProfileInput = {};
    if (displayName !== undefined) {
      patch.displayName = displayName;
    }
    if (bio !== undefined) {
      patch.bio = bio;
    }

    const record = await userRepository.updateProfile(userId, patch, clock.now());

    return {
      id: record.id,
      handle: record.handle,
      displayName: record.displayName,
      bio: record.bio,
    };
  };
