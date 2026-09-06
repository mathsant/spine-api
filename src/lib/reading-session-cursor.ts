import { ValidationError } from '../errors';

export type ReadingSessionStatus = 'reading' | 'finished';

export interface ReadingSessionCursorPayload {
  status: ReadingSessionStatus;
  createdAt: string;
  id: string;
}

/**
 * Opaque cursor for `GET /me/reading-sessions` (feature 010). Unlike the shared
 * `{ createdAt, id }` cursor, it also carries `status` because the list is ordered
 * by status group first (reading before finished), then `createdAt` desc. Cursors
 * emitted by the previous version of the endpoint lack `status` and are rejected.
 */
export function encodeReadingSessionCursor(payload: ReadingSessionCursorPayload): string {
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

export function decodeReadingSessionCursor(cursor: string): ReadingSessionCursorPayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  } catch {
    throw new ValidationError('Invalid cursor');
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new ValidationError('Invalid cursor');
  }

  const record = parsed as Record<string, unknown>;
  if (
    (record.status !== 'reading' && record.status !== 'finished') ||
    typeof record.createdAt !== 'string' ||
    typeof record.id !== 'string'
  ) {
    throw new ValidationError('Invalid cursor');
  }

  return { status: record.status, createdAt: record.createdAt, id: record.id };
}
