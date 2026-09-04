# Códigos de erro — Books Flow

Todos serializados no envelope único da 001:
`{ "error": { "code", "message", "statusCode", "details?" } }`.

| `code` | HTTP | Classe (`src/errors/*-error.ts`) | Origem | Spec |
|---|---|---|---|---|
| `VALIDATION_ERROR` | 400 | `ValidationError` (da 001) | querystring/body reprovado por schema `zod` | RF-001, RF-011, RF-014, RF-017 |
| `UNAUTHENTICATED` | 401 | `UnauthenticatedError` (da 002) | rota sem `Authorization: Bearer` válido | RF-020 |
| `INVALID_ACCESS_TOKEN` | 401 | `InvalidAccessTokenError` (da 002) | access token expirado/malformado/conta inexistente | RF-020 |
| `BOOK_NOT_FOUND` | 404 | `BookNotFoundError` | `olid` não está no cache e o Open Library não tem resultado exato pra essa chave | RF-003, RF-004 |
| `OPEN_LIBRARY_UNAVAILABLE` | 503 | `OpenLibraryUnavailableError` | timeout, erro de rede ou `5xx` do Open Library durante busca ou resolução de `olid` | RF-002 |
| `READING_SESSION_NOT_FOUND` | 404 | `ReadingSessionNotFoundError` | `sessionId` não existe **ou** pertence a outro usuário (nunca `403` — D9 do research.md) | RF-020 |
| `INVALID_READING_SESSION_STATE` | 409 | `InvalidReadingSessionStateError` | progress update numa session que não está `reading` | RF-012 |
| `INVALID_READING_SESSION_DATES` | 422 | `InvalidReadingSessionDatesError` | edição resultaria em `finishedAt < startedAt` | RF-017 |
| `INTERNAL_ERROR` | 500 | — (genérico da 001) | qualquer erro não `instanceof AppError` | — |

## Invariantes

- Nenhuma resposta de erro inclui detalhe cru do driver `mongodb` nem do `fetch` ao Open
  Library (stack trace, corpo bruto da resposta externa).
- `READING_SESSION_NOT_FOUND` é devolvido tanto para um `sessionId` inexistente quanto para
  um que pertence a outro usuário — nenhuma distinção na mensagem (evita confirmar a
  outro cliente que um `sessionId` de terceiro existe).
- `details` só aparece em `VALIDATION_ERROR`.
- Todo `code` casa com `^[A-Z][A-Z0-9_]*$` (schema da 001).
