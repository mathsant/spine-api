# Códigos de erro — Interações (comentar e curtir)

Todos serializados no envelope único da 001: `{ "error": { "code", "message", "statusCode",
"details?" } }`.

| `code` | HTTP | Classe (`src/errors/*-error.ts`) | Origem | Spec |
|---|---|---|---|---|
| `VALIDATION_ERROR` | 400 | `ValidationError` (da 001) | `text` vazio, `cursor` malformado, `limit` fora de 1–100 | RF-006 |
| `UNAUTHENTICATED` | 401 | `UnauthenticatedError` (da 002) | rota sem `Authorization: Bearer` válido | — |
| `ACTIVITY_NOT_FOUND` | 404 | `ActivityNotFoundError` (NOVO) | `activityId` não existe, ou existe mas não é visível ao viewer (não é o dono nem segue aprovado) | RF-012, RF-015 |
| `UNSUPPORTED_ACTIVITY_INTERACTION` | 422 | `UnsupportedActivityInteractionError` (NOVO) | alvo é do tipo `started_reading` | RF-011 |
| `COMMENT_NOT_FOUND` | 404 | `CommentNotFoundError` (NOVO) | `commentId` inexistente ou de outro autor (delete); `parentCommentId` inexistente ou de outro item (create) | RF-007, RF-009 |
| `COMMENT_NESTING_TOO_DEEP` | 422 | `CommentNestingTooDeepError` (NOVO) | `parentCommentId` aponta para uma resposta (nível 2+) | RF-010 |
| `REACTION_NOT_FOUND` | 404 | `ReactionNotFoundError` (NOVO) | descurtir um item sem curtida prévia do usuário | RF-003 |
| `INTERNAL_ERROR` | 500 | — (genérico da 001) | qualquer erro não `instanceof AppError` | — |

## Invariantes

- `ACTIVITY_NOT_FOUND` cobre, com a mesma resposta, tanto "não existe" quanto "existe mas não é
  seu" — a API nunca revela qual dos dois casos é (RF-012, RF-015, P6).
- Curtir/descurtir/comentar/listar em `started_reading` nunca é `ACTIVITY_NOT_FOUND` — o item é
  visível (aparece no feed), só a ação não é suportada; por isso `422`, não `404`.
- Nenhuma resposta de erro inclui detalhe cru do driver `mongodb`.
- `details` só aparece em `VALIDATION_ERROR`.
- Todo `code` casa com `^[A-Z][A-Z0-9_]*$` (schema da 001).
