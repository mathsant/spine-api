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
