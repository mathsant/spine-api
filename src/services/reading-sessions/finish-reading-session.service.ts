import type { Clock } from '../../container/cradle';
import { ReadingSessionNotFoundError } from '../../errors';
import type { ReadingSessionRepository } from '../../repositories/reading-sessions';
import { toReadingSessionDTO } from './to-dto';
import type { ReadingSessionDTO } from './types';

export interface FinishReadingSessionInput {
  userId: string;
  sessionId: string;
  finishedAt?: Date;
}

export type FinishReadingSession = (input: FinishReadingSessionInput) => Promise<ReadingSessionDTO>;

export interface FinishReadingSessionDeps {
  readingSessionRepository: ReadingSessionRepository;
  clock: Clock;
}

/** Finishes an open reading session (RF-015); idempotent if already finished. */
export const makeFinishReadingSession =
  ({ readingSessionRepository, clock }: FinishReadingSessionDeps): FinishReadingSession =>
  async ({ userId, sessionId, finishedAt }) => {
    const existing = await readingSessionRepository.findById(sessionId);
    if (!existing || existing.userId !== userId) {
      throw new ReadingSessionNotFoundError();
    }

    const record = await readingSessionRepository.finish(sessionId, finishedAt ?? clock.now());
    return toReadingSessionDTO(record);
  };
