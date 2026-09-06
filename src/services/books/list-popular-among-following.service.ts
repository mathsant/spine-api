import type { BookRecord, BookRepository } from '../../repositories/books';
import type { FollowRepository } from '../../repositories/follows';
import type { ReadingSessionRepository } from '../../repositories/reading-sessions';
import type { ShelfMembershipRepository } from '../../repositories/shelf-memberships';
import type { BookSearchResultDTO, PopularAmongFollowingResponseDTO } from './types';

const MAX_ITEMS = 20;

export interface ListPopularAmongFollowingInput {
  userId: string;
}

export type ListPopularAmongFollowing = (
  input: ListPopularAmongFollowingInput,
) => Promise<PopularAmongFollowingResponseDTO>;

export interface ListPopularAmongFollowingDeps {
  followRepository: FollowRepository;
  readingSessionRepository: ReadingSessionRepository;
  shelfMembershipRepository: ShelfMembershipRepository;
  bookRepository: BookRepository;
}

function toResultDTO(book: BookRecord): BookSearchResultDTO {
  return {
    olid: book.olid,
    isbn13: book.isbn13,
    title: book.title,
    authors: book.authors,
    coverUrl: book.coverUrl,
    firstPublishYear: book.firstPublishYear,
    pageCount: book.pageCount,
  };
}

/**
 * Books popular among the users the caller follows with an approved follow (P6),
 * for the empty state of book search. Ranked by the number of distinct followed
 * users with any reading session of the book (all-time), tie-broken by most recent
 * activity then by title. Books the caller already has a reading session or a
 * want-to-read mark for are excluded. At most 20, no pagination (feature 010,
 * RF-013..020).
 */
export const makeListPopularAmongFollowing =
  ({
    followRepository,
    readingSessionRepository,
    shelfMembershipRepository,
    bookRepository,
  }: ListPopularAmongFollowingDeps): ListPopularAmongFollowing =>
  async ({ userId }) => {
    const followeeIds = (await followRepository.listFolloweeIds(userId)).filter(
      (id) => id !== userId,
    );
    if (followeeIds.length === 0) {
      return { items: [] };
    }

    const [ownSessionBookIds, ownShelfBookIds] = await Promise.all([
      readingSessionRepository.listBookIdsForUser(userId),
      shelfMembershipRepository.listBookIdsForUser(userId),
    ]);
    const excludeBookIds = [...new Set([...ownSessionBookIds, ...ownShelfBookIds])];

    const ranked = await readingSessionRepository.aggregatePopularBookIdsForReaders(
      followeeIds,
      excludeBookIds,
      MAX_ITEMS,
    );
    if (ranked.length === 0) {
      return { items: [] };
    }

    const books = await Promise.all(ranked.map((entry) => bookRepository.findById(entry.bookId)));
    const items = ranked
      .map((entry, index) => ({ entry, book: books[index] }))
      .filter((pair): pair is { entry: (typeof ranked)[number]; book: BookRecord } => pair.book !== null)
      // Mongo already ordered by readerCount desc, then lastActivityAt desc; the
      // final title tie-break is applied here where the title lives.
      .sort((a, b) => {
        if (a.entry.readerCount !== b.entry.readerCount) {
          return b.entry.readerCount - a.entry.readerCount;
        }
        const byActivity = b.entry.lastActivityAt.getTime() - a.entry.lastActivityAt.getTime();
        return byActivity !== 0 ? byActivity : a.book.title.localeCompare(b.book.title);
      })
      .map((pair) => toResultDTO(pair.book));

    return { items };
  };
