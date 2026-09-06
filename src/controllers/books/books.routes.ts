import type { FastifyPluginCallback } from 'fastify';

import { getBookController } from './get-book.controller';
import { listBookReviewsController } from './list-book-reviews.controller';
import { listWantToReadController } from './list-want-to-read.controller';
import { markFinishedController } from './mark-finished.controller';
import { markWantToReadController } from './mark-want-to-read.controller';
import { searchBooksController } from './search-books.controller';
import { startReadingController } from './start-reading.controller';
import { unmarkWantToReadController } from './unmark-want-to-read.controller';

/**
 * Routes of the `books` domain. Registered under `{ prefix: '/v1' }`. Every route
 * requires a valid access token (RF-020) — none of this feature's endpoints expose
 * data belonging to anyone but the caller.
 */
export const booksRoutes: FastifyPluginCallback = (app, _opts, done) => {
  app.get('/books/search', { preHandler: app.authenticate }, searchBooksController);
  app.get('/books/:olid/reviews', { preHandler: app.authenticate }, listBookReviewsController);
  app.get('/books/:olid', { preHandler: app.authenticate }, getBookController);
  app.put('/books/:olid/want-to-read', { preHandler: app.authenticate }, markWantToReadController);
  app.delete(
    '/books/:olid/want-to-read',
    { preHandler: app.authenticate },
    unmarkWantToReadController,
  );
  app.post('/books/:olid/start-reading', { preHandler: app.authenticate }, startReadingController);
  app.post('/books/:olid/mark-finished', { preHandler: app.authenticate }, markFinishedController);
  app.get('/me/want-to-read', { preHandler: app.authenticate }, listWantToReadController);

  done();
};
