export interface BookSearchResultDTO {
  olid: string;
  isbn13: string | null;
  title: string;
  authors: string[];
  coverUrl: string | null;
  firstPublishYear: number | null;
  pageCount: number | null;
}

export interface BookSearchPageDTO {
  items: BookSearchResultDTO[];
  page: number;
  limit: number;
  totalItems: number;
}

export interface BookDetailDTO extends BookSearchResultDTO {
  id: string;
  aggregates: {
    averageRating: number | null;
    reviewCount: number;
    readerCount: number;
  };
}

export interface BookCursorPageDTO {
  items: BookSearchResultDTO[];
  nextCursor: string | null;
}

/** Author block of a `BookReviewByFollowingDTO`. `avatarUrl` is always `null` for now
 * (avatar upload is not part of the API yet) — same convention as `UserSearchResult`. */
export interface BookReviewAuthorDTO {
  userId: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
}

/** One item of `GET /books/{olid}/reviews` — a review of the book by someone the
 * caller follows (approved). At most one per followed user (feature 010). */
export interface BookReviewByFollowingDTO {
  reviewId: string;
  author: BookReviewAuthorDTO;
  rating: number;
  text: string | null;
  containsSpoiler: boolean;
  createdAt: string;
}

export interface BookReviewByFollowingCursorPageDTO {
  items: BookReviewByFollowingDTO[];
  nextCursor: string | null;
}

/** Response of `GET /books/popular-among-following` — up to 20 books, no pagination. */
export interface PopularAmongFollowingResponseDTO {
  items: BookSearchResultDTO[];
}
