import { createServer, type Server } from 'node:http';
import { setTimeout as sleep } from 'node:timers/promises';

import { afterEach, describe, expect, it } from 'vitest';

import { OpenLibraryUnavailableError } from '../../../../src/errors';
import { HttpOpenLibraryClient } from '../../../../src/integrations/open-library';

type Handler = (url: URL) => { status: number; body?: unknown; delayMs?: number };

async function startStub(handler: Handler): Promise<{ baseUrl: string; server: Server }> {
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://stub.local');
    const result = handler(url);
    void (async () => {
      if (result.delayMs) {
        await sleep(result.delayMs);
      }
      res.statusCode = result.status;
      res.setHeader('content-type', 'application/json');
      res.end(result.body !== undefined ? JSON.stringify(result.body) : '');
    })();
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('failed to bind stub server');
  }

  return { baseUrl: `http://127.0.0.1:${address.port}`, server };
}

describe('HttpOpenLibraryClient', () => {
  let server: Server | undefined;

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve) => server?.close(() => resolve()));
      server = undefined;
    }
  });

  it('maps search.json docs to OpenLibrarySearchResult[]', async () => {
    const stub = await startStub(() => ({
      status: 200,
      body: {
        numFound: 1,
        docs: [
          {
            key: '/works/OL12345W',
            title: 'Duna',
            author_name: ['Frank Herbert'],
            cover_i: 999,
            first_publish_year: 1965,
            isbn: ['0441013597', '9780441013593'],
          },
        ],
      },
    }));
    server = stub.server;

    const client = new HttpOpenLibraryClient({ baseUrl: stub.baseUrl, timeoutMs: 2000 });
    const page = await client.search('duna', 1, 20);

    expect(page).toEqual({
      items: [
        {
          olid: 'OL12345W',
          isbn13: '9780441013593',
          title: 'Duna',
          authors: ['Frank Herbert'],
          coverUrl: 'https://covers.openlibrary.org/b/id/999-M.jpg',
          firstPublishYear: 1965,
        },
      ],
      page: 1,
      limit: 20,
      totalItems: 1,
    });
  });

  it('maps a doc with no cover/isbn/year to nulls, not errors', async () => {
    const stub = await startStub(() => ({
      status: 200,
      body: { numFound: 1, docs: [{ key: '/works/OL1W', title: 'Sem metadados' }] },
    }));
    server = stub.server;

    const client = new HttpOpenLibraryClient({ baseUrl: stub.baseUrl, timeoutMs: 2000 });
    const page = await client.search('sem metadados', 1, 20);

    expect(page.items[0]).toEqual({
      olid: 'OL1W',
      isbn13: null,
      title: 'Sem metadados',
      authors: [],
      coverUrl: null,
      firstPublishYear: null,
    });
  });

  it('search returns an empty page on numFound: 0 (not an error)', async () => {
    const stub = await startStub(() => ({ status: 200, body: { numFound: 0, docs: [] } }));
    server = stub.server;

    const client = new HttpOpenLibraryClient({ baseUrl: stub.baseUrl, timeoutMs: 2000 });
    const page = await client.search('nada-encontrado', 1, 20);

    expect(page).toEqual({ items: [], page: 1, limit: 20, totalItems: 0 });
  });

  it('findByKey returns null on numFound: 0', async () => {
    const stub = await startStub(() => ({ status: 200, body: { numFound: 0, docs: [] } }));
    server = stub.server;

    const client = new HttpOpenLibraryClient({ baseUrl: stub.baseUrl, timeoutMs: 2000 });
    await expect(client.findByKey('OL_GHOST_W')).resolves.toBeNull();
  });

  it('findByKey returns the matching result', async () => {
    const stub = await startStub(() => ({
      status: 200,
      body: { numFound: 1, docs: [{ key: '/works/OL9W', title: 'Achado' }] },
    }));
    server = stub.server;

    const client = new HttpOpenLibraryClient({ baseUrl: stub.baseUrl, timeoutMs: 2000 });
    await expect(client.findByKey('OL9W')).resolves.toMatchObject({ olid: 'OL9W', title: 'Achado' });
  });

  it('throws OpenLibraryUnavailableError on a 5xx response', async () => {
    const stub = await startStub(() => ({ status: 503 }));
    server = stub.server;

    const client = new HttpOpenLibraryClient({ baseUrl: stub.baseUrl, timeoutMs: 2000 });
    await expect(client.search('duna', 1, 20)).rejects.toBeInstanceOf(OpenLibraryUnavailableError);
  });

  it('throws OpenLibraryUnavailableError on timeout', async () => {
    const stub = await startStub(() => ({ status: 200, body: { numFound: 0, docs: [] }, delayMs: 300 }));
    server = stub.server;

    const client = new HttpOpenLibraryClient({ baseUrl: stub.baseUrl, timeoutMs: 50 });
    await expect(client.search('duna', 1, 20)).rejects.toBeInstanceOf(OpenLibraryUnavailableError);
  });

  it('throws OpenLibraryUnavailableError when nothing is listening', async () => {
    const client = new HttpOpenLibraryClient({ baseUrl: 'http://127.0.0.1:1', timeoutMs: 500 });
    await expect(client.search('duna', 1, 20)).rejects.toBeInstanceOf(OpenLibraryUnavailableError);
  });
});
