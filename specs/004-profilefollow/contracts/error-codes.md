# Códigos de erro — Profile & Follow

Todos serializados no envelope único da 001:
`{ "error": { "code", "message", "statusCode", "details?" } }`.

| `code` | HTTP | Classe (`src/errors/*-error.ts`) | Origem | Spec |
|---|---|---|---|---|
| `VALIDATION_ERROR` | 400 | `ValidationError` (da 001) | body/querystring reprovado por schema `zod` | RF-002, RF-004 |
| `UNAUTHENTICATED` | 401 | `UnauthenticatedError` (da 002) | rota sem `Authorization: Bearer` válido | RF-021 |
| `INVALID_ACCESS_TOKEN` | 401 | `InvalidAccessTokenError` (da 002) | access token expirado/malformado/conta inexistente | RF-021 |
| `NOT_FOUND` | 404 | `NotFoundError` (da 001) | `:userId` da rota não corresponde a nenhum usuário | RF-005 |
| `CANNOT_FOLLOW_SELF` | 422 | `CannotFollowSelfError` | pedido de follow para o próprio usuário | RF-006 |
| `ALREADY_FOLLOWING` | 409 | `AlreadyFollowingError` | novo pedido de follow quando já existe follow aprovado do remetente pro alvo | RF-007 |
| `FOLLOW_REQUEST_NOT_FOUND` | 404 | `FollowRequestNotFoundError` | aprovar/recusar/cancelar um pedido que não existe para o par esperado (nunca existiu, já foi resolvido, ou não pertence a esse par — nunca `403`, D7 do research.md) | RF-016 |
| `FOLLOW_NOT_FOUND` | 404 | `FollowNotFoundError` | deixar de seguir/remover seguidor de um par sem relação aprovada (nunca `403`, D7 do research.md) | RF-017 |
| `INTERNAL_ERROR` | 500 | — (genérico da 001) | qualquer erro não `instanceof AppError` | — |

## Invariantes

- Nenhuma resposta de erro inclui detalhe cru do driver `mongodb`.
- `FOLLOW_REQUEST_NOT_FOUND` e `FOLLOW_NOT_FOUND` são devolvidos tanto para um par
  inexistente quanto para um que existe mas não pertence ao usuário autenticado — nenhuma
  distinção na mensagem (evita confirmar a outro cliente que uma relação de terceiro existe,
  mesmo padrão de `READING_SESSION_NOT_FOUND` na 003).
- `GET /v1/users/search` **nunca** devolve `403`/`404` por falta de resultado — lista vazia é
  uma resposta `200` válida (RF-004, mesmo padrão de `BookSearchPage`).
- `GET /v1/me/followers` e `GET /v1/me/following` não aceitam `:userId` de terceiro — não há
  rota para isso nesta feature (RF-020); não é um caso de erro, é a ausência do endpoint.
- `details` só aparece em `VALIDATION_ERROR`.
- Todo `code` casa com `^[A-Z][A-Z0-9_]*$` (schema da 001).
