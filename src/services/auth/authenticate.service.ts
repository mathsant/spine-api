import { verifyAccessToken } from '../../auth';
import { InvalidAccessTokenError } from '../../errors';
import type { UserRepository } from '../../repositories/users';
import { type PublicUser, toPublicUser } from './types';

export type Authenticate = (accessToken: string) => Promise<PublicUser>;

export interface AuthenticateDeps {
  userRepository: Pick<UserRepository, 'findById'>;
  config: { accessTokenSecret: string };
}

/**
 * Business rule behind every protected route: verify the access token, then load
 * the account it points at (RF-018). A bad token or a missing account is an
 * `InvalidAccessTokenError`.
 */
export const makeAuthenticate =
  ({ userRepository, config }: AuthenticateDeps): Authenticate =>
  async (accessToken) => {
    const { userId } = verifyAccessToken(accessToken, config.accessTokenSecret);

    const user = await userRepository.findById(userId);
    if (!user) {
      throw new InvalidAccessTokenError();
    }

    return toPublicUser(user);
  };
