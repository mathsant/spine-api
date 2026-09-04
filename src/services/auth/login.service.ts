import {
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_INACTIVITY_DAYS,
  generateRefreshToken,
  hashPassword,
  normalizeEmail,
  signAccessToken,
  verifyPassword,
} from '../../auth';
import { InvalidCredentialsError } from '../../errors';
import type { AuthSessionRepository } from '../../repositories/auth-sessions';
import type { UserRepository } from '../../repositories/users';
import type { TokenPair } from './types';

export interface LoginInput {
  email: string;
  password: string;
}

export type Login = (input: LoginInput) => Promise<TokenPair>;

export interface LoginDeps {
  userRepository: Pick<UserRepository, 'findByEmail'>;
  authSessionRepository: Pick<AuthSessionRepository, 'createSession'>;
  config: { accessTokenSecret: string };
  clock: { now(): Date };
}

const DAY_MS = 24 * 60 * 60 * 1000;

// A well-formed hash used when no account matched, so `verifyPassword` still runs
// the KDF and the failure timing does not reveal whether the email exists (RF-014).
let dummyHash: Promise<string> | undefined;
function getDummyHash(): Promise<string> {
  dummyHash ??= hashPassword('no-account-placeholder');
  return dummyHash;
}

export const makeLogin =
  ({ userRepository, authSessionRepository, config, clock }: LoginDeps): Login =>
  async (input) => {
    const email = normalizeEmail(input.email);
    const user = await userRepository.findByEmail(email);
    const passwordOk = await verifyPassword(
      input.password,
      user ? user.passwordHash : await getDummyHash(),
    );

    if (!user || !passwordOk) {
      throw new InvalidCredentialsError();
    }

    const now = clock.now();
    const expiresAt = new Date(now.getTime() + REFRESH_INACTIVITY_DAYS * DAY_MS);
    const { token, tokenHash } = generateRefreshToken();

    await authSessionRepository.createSession({
      userId: user.id,
      refreshTokenHash: tokenHash,
      now,
      inactivityExpiresAt: expiresAt,
      refreshExpiresAt: expiresAt,
    });

    return {
      accessToken: signAccessToken({ userId: user.id }, config.accessTokenSecret),
      refreshToken: token,
      tokenType: 'Bearer',
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    };
  };
