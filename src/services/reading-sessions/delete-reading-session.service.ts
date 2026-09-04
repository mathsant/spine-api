import { ReadingSessionNotFoundError } from '../../errors';
import type { ReadingSessionRepository } from '../../repositories/reading-sessions';

export interface DeleteReadingSessionInput {
  userId: string;
  sessionId: string;
}

export type DeleteReadingSession = (input: DeleteReadingSessionInput) => Promise<void>;

export interface DeleteReadingSessionDeps {
  readingSessionRepository: ReadingSessionRepository;
}

/** Deletes a reading session (RF-018). Ownership checked here (D9). */
export const makeDeleteReadingSession =
  ({ readingSessionRepository }: DeleteReadingSessionDeps): DeleteReadingSession =>
  async ({ userId, sessionId }) => {
    const existing = await readingSessionRepository.findById(sessionId);
    if (!existing || existing.userId !== userId) {
      throw new ReadingSessionNotFoundError();
    }

    await readingSessionRepository.delete(sessionId);
  };
