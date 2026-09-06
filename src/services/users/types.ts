import type { FollowState } from '../follows';

export interface UserSearchResultDTO {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  /** Viewer -> this user. See `UserProfileDTO.followState`. */
  followState: FollowState;
  /** This user -> viewer (approved follow only). */
  followsYou: boolean;
}

export interface UserSearchPageDTO {
  items: UserSearchResultDTO[];
  page: number;
  limit: number;
  totalItems: number;
}

/** One item of `GET /v1/users/suggestions` (012). `UserSearchResultDTO` + `mutualFollowersCount`. */
export interface FollowSuggestionDTO {
  id: string;
  handle: string;
  displayName: string;
  /** Always `null` for now — avatar upload does not exist in the API. */
  avatarUrl: string | null;
  /** Always `'none'` on this route — anyone the viewer already follows or has a pending request to is excluded. */
  followState: FollowState;
  /** This user -> viewer (approved follow only). */
  followsYou: boolean;
  /** Approved-follows of the viewer who also follow this user; `0` on the popularity fallback. */
  mutualFollowersCount: number;
}

/** Response of `GET /v1/users/suggestions` (012). Not paginated; at most 4 items. */
export interface FollowSuggestionsResponseDTO {
  items: FollowSuggestionDTO[];
}

/** Response of `GET /v1/users/:userId` (011 — D1). */
export interface UserProfileDTO {
  id: string;
  handle: string;
  displayName: string;
  /** Always `null` for now — avatar upload does not exist in the API. */
  avatarUrl: string | null;
  /** Real text only when `followState === 'following'`; `null` otherwise (P6). */
  bio: string | null;
  /** Viewer -> this user: `none`, `pending` (request sent), `following` (approved). */
  followState: FollowState;
  /** This user -> viewer (approved follow only; a pending request does not count). */
  followsYou: boolean;
}
