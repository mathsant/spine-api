import type { Clock } from '../../container/cradle';
import { ReadingSessionNotFoundError } from '../../errors';
import type { ActivityRepository } from '../../repositories/activities';
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
  activityRepository: ActivityRepository;
  clock: Clock;
}

/** Finishes an open reading session (RF-015); idempotent if already finished. */
export const makeFinishReadingSession =
  ({ readingSessionRepository, activityRepository, clock }: FinishReadingSessionDeps): FinishReadingSession =>
  async ({ userId, sessionId, finishedAt }) => {
    const existing = await readingSessionRepository.findById(sessionId);
    if (!existing || existing.userId !== userId) {
      throw new ReadingSessionNotFoundError();
    }

    const now = clock.now();
    const record = await readingSessionRepository.finish(sessionId, finishedAt ?? now);

    if (existing.status !== 'finished') {
      // Guards against duplicating the event on an idempotent re-finish (006, RF-002).
      await activityRepository.record(
        { type: 'finished_reading', actorId: userId, bookId: existing.bookId, readingSessionId: sessionId },
        now,
      );
    }

    return toReadingSessionDTO(record);
  };
