import type { BookRepository } from '../../repositories/books';
import type { ShelfMembershipRepository } from '../../repositories/shelf-memberships';
import type { BookCursorPageDTO, BookSearchResultDTO } from './types';

export interface ListWantToReadInput {
  userId: string;
  cursor: string | null;
  limit: number;
}

export type ListWantToRead = (input: ListWantToReadInput) => Promise<BookCursorPageDTO>;

export interface ListWantToReadDeps {
  shelfMembershipRepository: ShelfMembershipRepository;
  bookRepository: BookRepository;
}

function toResultDTO(book: {
  olid: string;
  isbn13: string | null;
  title: string;
  authors: string[];
  coverUrl: string | null;
  firstPublishYear: number | null;
  pageCount: number | null;
}): BookSearchResultDTO {
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

/** Lists the books the user marked "want to read", most recently marked first (RF-007). */
export const makeListWantToRead =
  ({ shelfMembershipRepository, bookRepository }: ListWantToReadDeps): ListWantToRead =>
  async ({ userId, cursor, limit }) => {
    const page = await shelfMembershipRepository.list(userId, cursor, limit);

    const books = await Promise.all(
      page.items.map((membership) => bookRepository.findById(membership.bookId)),
    );

    return {
      items: books.filter((book) => book !== null).map(toResultDTO),
      nextCursor: page.nextCursor,
    };
  };
