/** Persisted shape of a user, with the Mongo `_id` surfaced as a hex string `id`. */
export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  handle: string;
  displayName: string;
  bio: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Fields the service supplies to create a user. `email`/`handle` are already normalised. */
export interface CreateUserInput {
  email: string;
  passwordHash: string;
  handle: string;
  displayName: string;
}

/** Fields the service supplies to edit a profile. Only the present keys are updated. */
export interface UpdateProfileInput {
  displayName?: string;
  bio?: string | null;
}

/** Minimal user shape returned by `search` (P14 — no other profile data). */
export interface UserSearchResult {
  id: string;
  handle: string;
  displayName: string;
}

export interface UserSearchPage {
  items: UserSearchResult[];
  page: number;
  limit: number;
  totalItems: number;
}

/** Data-access port for the `users` collection. Only implementations touch the driver. */
export interface UserRepository {
  /**
   * Inserts a user. On a unique-index violation the raw driver error is translated
   * to `EmailAlreadyInUseError` or `HandleAlreadyInUseError` (never leaks upward).
   */
  create(input: CreateUserInput): Promise<UserRecord>;

  findByEmail(email: string): Promise<UserRecord | null>;
  findByHandle(handle: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;

  /** Sets a new password hash and `updatedAt`. */
  updatePasswordHash(id: string, passwordHash: string, now: Date): Promise<void>;

  /** `$set` of only the keys present in `patch`, plus `updatedAt` (RF-002). */
  updateProfile(id: string, patch: UpdateProfileInput, now: Date): Promise<UserRecord>;

  /** `$text` search over `displayName`/`handle`, ranked by relevance, paginated by page (D2/D3). */
  search(query: string, page: number, limit: number): Promise<UserSearchPage>;
}
