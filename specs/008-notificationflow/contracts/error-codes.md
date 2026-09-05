# Códigos de erro — Fluxo de notificações

Todos serializados no envelope único da 001: `{ "error": { "code", "message", "statusCode",
"details?" } }`.

| `code` | HTTP | Classe (`src/errors/*-error.ts`) | Origem | Spec |
|---|---|---|---|---|
| `VALIDATION_ERROR` | 400 | `ValidationError` (da 001) | `cursor` malformado, `limit` fora de 1–100 na querystring de `GET /v1/me/notifications` | — |
| `UNAUTHENTICATED` | 401 | `UnauthenticatedError` (da 002) | rota sem `Authorization: Bearer` válido | — |
| `NOTIFICATION_NOT_FOUND` | 404 | `NotificationNotFoundError` (NOVO) | `notificationId` inexistente, ou existe mas pertence a outro usuário | RF-012, RF-013 |
| `INTERNAL_ERROR` | 500 | — (genérico da 001) | qualquer erro não `instanceof AppError` | — |

## Invariantes

- `NOTIFICATION_NOT_FOUND` cobre, com a mesma resposta, tanto "não existe" quanto "existe mas não
  é do usuário autenticado" — a API nunca revela qual dos dois casos é (mesmo raciocínio de
  privacidade já usado por `ACTIVITY_NOT_FOUND`/`COMMENT_NOT_FOUND` em 007).
- `POST /v1/notifications/:notificationId/read` e `POST /v1/notifications/read-all` nunca
  retornam erro por já estarem lidas — são idempotentes (RF-015); repetir devolve o mesmo sucesso.
- Nenhuma resposta de erro inclui detalhe cru do driver `mongodb`.
- `details` só aparece em `VALIDATION_ERROR`.
- Todo `code` casa com `^[A-Z][A-Z0-9_]*$` (schema da 001).

## Nota sobre erros de outras features

Os 4 endpoints desta feature (`GET /v1/me/notifications`, `GET /v1/me/notifications/unread-count`,
`POST /v1/notifications/:notificationId/read`, `POST /v1/notifications/read-all`) não expõem
nenhum outro código de erro além dos listados acima. Os services alterados de outras features
(`send-follow-request`, `approve-follow-request`, `reject-follow-request`, `create-comment`,
`delete-comment`, `create-reaction`, `delete-reaction`, `delete-reading-session`, `delete-review`)
continuam retornando exatamente os mesmos códigos já documentados nos contratos de 004/005/007 —
esta feature não adiciona nem remove nenhum caminho de erro desses endpoints existentes.
