import { ReadingSessionNotFoundError } from '../../errors';
import type { EditReadingSessionInput, ReadingSessionRepository } from '../../repositories/reading-sessions';
import { toReadingSessionDTO } from './to-dto';
import type { ReadingSessionDTO } from './types';

export interface EditReadingSessionServiceInput {
  userId: string;
  sessionId: string;
  patch: EditReadingSessionInput;
}

export type EditReadingSession = (input: EditReadingSessionServiceInput) => Promise<ReadingSessionDTO>;

export interface EditReadingSessionDeps {
  readingSessionRepository: ReadingSessionRepository;
}

/** Corrects `startedAt`/`finishedAt`/`currentPage` of an existing session (RF-017). */
export const makeEditReadingSession =
  ({ readingSessionRepository }: EditReadingSessionDeps): EditReadingSession =>
  async ({ userId, sessionId, patch }) => {
    const existing = await readingSessionRepository.findById(sessionId);
    if (!existing || existing.userId !== userId) {
      throw new ReadingSessionNotFoundError();
    }

    const record = await readingSessionRepository.edit(sessionId, patch);
    return toReadingSessionDTO(record);
  };
