import { describe, expect, it } from 'vitest';

import {
  compareSuggestionCandidates,
  type SuggestionCandidate,
} from '../../../../src/services/users/compare-suggestion-candidates';

function candidate(overrides: Partial<SuggestionCandidate>): SuggestionCandidate {
  return {
    userId: '507f1f77bcf86cd799439011',
    mutualFollowersCount: 0,
    followerCount: 0,
    handle: 'user',
    displayName: 'User',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('compareSuggestionCandidates', () => {
  it('orders by mutualFollowersCount desc first', () => {
    const low = candidate({ userId: 'a', mutualFollowersCount: 1, followerCount: 999 });
    const high = candidate({ userId: 'b', mutualFollowersCount: 5, followerCount: 0 });

    expect([low, high].sort(compareSuggestionCandidates).map((c) => c.userId)).toEqual(['b', 'a']);
  });

  it('breaks a mutualFollowersCount tie by followerCount desc', () => {
    const fewFollowers = candidate({ userId: 'a', mutualFollowersCount: 2, followerCount: 3 });
    const manyFollowers = candidate({ userId: 'b', mutualFollowersCount: 2, followerCount: 30 });

    expect(
      [fewFollowers, manyFollowers].sort(compareSuggestionCandidates).map((c) => c.userId),
    ).toEqual(['b', 'a']);
  });

  it('breaks a further tie by createdAt desc (most recent first)', () => {
    const older = candidate({
      userId: 'a',
      mutualFollowersCount: 2,
      followerCount: 5,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    const newer = candidate({
      userId: 'b',
      mutualFollowersCount: 2,
      followerCount: 5,
      createdAt: new Date('2026-06-01T00:00:00.000Z'),
    });

    expect([older, newer].sort(compareSuggestionCandidates).map((c) => c.userId)).toEqual(['b', 'a']);
  });

  it('resolves a total tie deterministically by userId (desc)', () => {
    const common = {
      mutualFollowersCount: 1,
      followerCount: 1,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    const a = candidate({ userId: 'aaa', ...common });
    const b = candidate({ userId: 'bbb', ...common });
    const c = candidate({ userId: 'ccc', ...common });

    expect([a, b, c].sort(compareSuggestionCandidates).map((x) => x.userId)).toEqual([
      'ccc',
      'bbb',
      'aaa',
    ]);
    // stable regardless of input order
    expect([c, a, b].sort(compareSuggestionCandidates).map((x) => x.userId)).toEqual([
      'ccc',
      'bbb',
      'aaa',
    ]);
  });

  it('sorts a mixed list the way the ranking rules dictate', () => {
    const list: SuggestionCandidate[] = [
      candidate({ userId: 'w', mutualFollowersCount: 1, followerCount: 10 }),
      candidate({ userId: 'x', mutualFollowersCount: 3, followerCount: 1 }),
      candidate({ userId: 'y', mutualFollowersCount: 3, followerCount: 8 }),
      candidate({ userId: 'z', mutualFollowersCount: 2, followerCount: 100 }),
    ];

    expect(list.sort(compareSuggestionCandidates).map((c) => c.userId)).toEqual([
      'y',
      'x',
      'z',
      'w',
    ]);
  });
});
