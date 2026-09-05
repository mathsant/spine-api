# Códigos de erro — Feed de atividade

Todos serializados no envelope único da 001: `{ "error": { "code", "message", "statusCode",
"details?" } }`. Esta feature **não introduz nenhum erro novo** — só reaproveita os já existentes.

| `code` | HTTP | Classe (`src/errors/*-error.ts`) | Origem | Spec |
|---|---|---|---|---|
| `VALIDATION_ERROR` | 400 | `ValidationError` (da 001) | `cursor` malformado ou `limit` fora de 1–100 no `GET /v1/feed` | RF-012 |
| `UNAUTHENTICATED` | 401 | `UnauthenticatedError` (da 002) | rota sem `Authorization: Bearer` válido | — |
| `INTERNAL_ERROR` | 500 | — (genérico da 001) | qualquer erro não `instanceof AppError` | — |

## Invariantes

- `GET /v1/feed` nunca responde `404`/`403` — o único filtro é o que aparece na lista (RF-007);
  não existir atividade não é um erro (RF-013).
- Nenhuma resposta de erro inclui detalhe cru do driver `mongodb`.
- `details` só aparece em `VALIDATION_ERROR`.
- Todo `code` casa com `^[A-Z][A-Z0-9_]*$` (schema da 001).
