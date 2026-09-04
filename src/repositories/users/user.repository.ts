/** Persisted shape of a user, with the Mongo `_id` surfaced as a hex string `id`. */
export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  handle: string;
  displayName: string;
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
}
