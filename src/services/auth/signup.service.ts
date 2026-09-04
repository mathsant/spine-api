import { hashPassword, normalizeEmail, normalizeHandle } from '../../auth';
import { EmailAlreadyInUseError, HandleAlreadyInUseError } from '../../errors';
import type { UserRepository } from '../../repositories/users';
import { type PublicUser, toPublicUser } from './types';

export interface SignupInput {
  email: string;
  password: string;
  handle: string;
  displayName: string;
}

export type Signup = (input: SignupInput) => Promise<PublicUser>;

export interface SignupDeps {
  userRepository: UserRepository;
}

/**
 * Creates an account. Normalises the email/handle, rejects a collision up front
 * with a friendly error, then relies on the unique index as the race backstop
 * (the repository translates a `code 11000` into the same domain error). Does not
 * issue tokens (RF-011).
 */
export const makeSignup =
  ({ userRepository }: SignupDeps): Signup =>
  async (input) => {
    const email = normalizeEmail(input.email);
    const handle = normalizeHandle(input.handle);

    if (await userRepository.findByEmail(email)) {
      throw new EmailAlreadyInUseError();
    }
    if (await userRepository.findByHandle(handle)) {
      throw new HandleAlreadyInUseError();
    }

    const passwordHash = await hashPassword(input.password);
    const user = await userRepository.create({
      email,
      passwordHash,
      handle,
      displayName: input.displayName.trim(),
    });

    return toPublicUser(user);
  };
