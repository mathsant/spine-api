import type { UserRepository } from '../../repositories/users';
import type { UserSearchPageDTO } from './types';

export interface SearchUsersInput {
  q: string;
  page: number;
  limit: number;
}

export type SearchUsers = (input: SearchUsersInput) => Promise<UserSearchPageDTO>;

export interface SearchUsersDeps {
  userRepository: UserRepository;
}

/** Searches users by displayName/handle (RF-004, P14 — minimal result surface). */
export const makeSearchUsers =
  ({ userRepository }: SearchUsersDeps): SearchUsers =>
  async ({ q, page, limit }) => {
    const result = await userRepository.search(q, page, limit);

    return {
      items: result.items.map((item) => ({
        id: item.id,
        handle: item.handle,
        displayName: item.displayName,
        avatarUrl: null,
      })),
      page: result.page,
      limit: result.limit,
      totalItems: result.totalItems,
    };
  };
