/**
 * Identifier normalisation shared by the auth services and the login rate-limit key.
 * `email` and `handle` are stored in their normalised form so a plain unique index
 * gives case-insensitive uniqueness (see the migrations).
 */

/** Trim surrounding whitespace and lowercase — emails are treated as case-insensitive. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Lowercase — the canonical, immutable handle is the lowercase form (D9). */
export function normalizeHandle(handle: string): string {
  return handle.toLowerCase();
}
