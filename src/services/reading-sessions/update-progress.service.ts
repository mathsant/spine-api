import { ReadingSessionNotFoundError } from '../../errors';
import type { ReadingSessionRepository } from '../../repositories/reading-sessions';
import { toReadingSessionDTO } from './to-dto';
import type { ReadingSessionDTO } from './types';

export interface UpdateProgressInput {
  userId: string;
  sessionId: string;
  currentPage: number;
}

export type UpdateProgress = (input: UpdateProgressInput) => Promise<ReadingSessionDTO>;

export interface UpdateProgressDeps {
  readingSessionRepository: ReadingSessionRepository;
}

/**
 * Registers the current page on an open reading session (RF-011). Ownership is
 * checked here (D9): a session that exists but belongs to someone else is reported
 * the same as a nonexistent one.
 */
export const makeUpdateProgress =
  ({ readingSessionRepository }: UpdateProgressDeps): UpdateProgress =>
  async ({ userId, sessionId, currentPage }) => {
    const existing = await readingSessionRepository.findById(sessionId);
    if (!existing || existing.userId !== userId) {
      throw new ReadingSessionNotFoundError();
    }

    const record = await readingSessionRepository.updateProgress(sessionId, currentPage);
    return toReadingSessionDTO(record);
  };
