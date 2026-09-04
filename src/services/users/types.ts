export interface UserSearchResultDTO {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface UserSearchPageDTO {
  items: UserSearchResultDTO[];
  page: number;
  limit: number;
  totalItems: number;
}
