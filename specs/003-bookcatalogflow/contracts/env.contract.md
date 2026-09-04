# Contrato de ambiente — Books Flow

Estende `src/config/env.schema.ts` (única porta para `process.env`). Ambas as variáveis têm
default sensato — nenhuma nova variável obrigatória nesta feature (diferente de
`ACCESS_TOKEN_SECRET` na 002, que é segredo sem default).

| Var | Obrigatória | Default | Regra | Uso |
|---|---|---|---|---|
| `OPEN_LIBRARY_BASE_URL` | não | `https://openlibrary.org` | URL válida | base para `search.json` no `HttpOpenLibraryClient` |
| `OPEN_LIBRARY_TIMEOUT_MS` | não | `5000` | inteiro ≥ 100 (coerção de string) | timeout do `fetch` via `AbortController`; estourou ⇒ `OpenLibraryUnavailableError` |

Nenhuma dessas variáveis é segredo — ambas podem aparecer em log/config de debug sem risco.
