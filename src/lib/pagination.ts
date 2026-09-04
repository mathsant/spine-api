import { ValidationError } from '../errors';

export interface CursorPayload {
  createdAt: string;
  id: string;
}

/** Opaque cursor for the feature's internal cursor-paginated lists (books/reading-sessions). */
export function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

/** Decodes a cursor produced by {@link encodeCursor}. A malformed cursor is a client error. */
export function decodeCursor(cursor: string): CursorPayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  } catch {
    throw new ValidationError('Invalid cursor');
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    typeof (parsed as Record<string, unknown>).createdAt !== 'string' ||
    typeof (parsed as Record<string, unknown>).id !== 'string'
  ) {
    throw new ValidationError('Invalid cursor');
  }

  return parsed as CursorPayload;
}
