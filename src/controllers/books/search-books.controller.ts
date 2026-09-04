import type { FastifyReply, FastifyRequest } from 'fastify';

import { searchBooksSchema } from '../../schemas/books';
import type { SearchBooks } from '../../services/books';

export async function searchBooksController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const input = searchBooksSchema.parse(request.query);
  const searchBooks = request.diScope.resolve<SearchBooks>('searchBooksService');

  const page = await searchBooks(input);

  await reply.status(200).send(page);
}
