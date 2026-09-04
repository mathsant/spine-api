import { createServer, type Server } from 'node:http';

export interface OpenLibraryStub {
  baseUrl: string;
  /** Replaces the fixed list of docs served for every `/search.json` call. */
  setDocs: (docs: Record<string, unknown>[]) => void;
  close: () => Promise<void>;
}

/**
 * A tiny real HTTP server standing in for Open Library, used by full-app
 * (`app.inject()`) route tests: `buildApp` always wires the real
 * `HttpOpenLibraryClient` (there is no DI seam to swap it for a fake at that layer),
 * so route tests point `config.openLibraryBaseUrl` at this stub instead of the real
 * Open Library. Service-level tests use `FakeOpenLibraryClient` instead (plan.md D8).
 * Does not inspect the query — the caller drives what comes back via `setDocs`.
 */
export async function startOpenLibraryStub(
  initialDocs: Record<string, unknown>[],
): Promise<OpenLibraryStub> {
  let docs = initialDocs;

  const server: Server = createServer((_req, res) => {
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ numFound: docs.length, docs }));
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('failed to bind Open Library stub server');
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    setDocs: (next) => {
      docs = next;
    },
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
