import type { FastifyReply, FastifyRequest } from 'fastify';

import type { GetBook } from '../../services/books';

export async function getBookController(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { olid } = request.params as { olid: string };
  const getBook = request.diScope.resolve<GetBook>('getBookService');

  const book = await getBook({ olid });

  await reply.status(200).send(book);
}
