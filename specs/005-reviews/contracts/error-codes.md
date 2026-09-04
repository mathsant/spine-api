# Códigos de erro — Reviews

Todos serializados no envelope único da 001:
`{ "error": { "code", "message", "statusCode", "details?" } }`.

| `code` | HTTP | Classe (`src/errors/*-error.ts`) | Origem | Spec |
|---|---|---|---|---|
| `VALIDATION_ERROR` | 400 | `ValidationError` (da 001) | body reprovado por schema `zod` (rating fora de 1–5, texto > 2000 chars, edição sem nenhum campo) | RF-004, RF-005, RF-011 |
| `UNAUTHENTICATED` | 401 | `UnauthenticatedError` (da 002) | rota sem `Authorization: Bearer` válido | — |
| `READING_SESSION_NOT_FOUND` | 404 | `ReadingSessionNotFoundError` (da 003, reaproveitado) | criar review numa `:sessionId` que não existe ou não pertence ao usuário | RF-008 |
| `READING_SESSION_NOT_FINISHED` | 409 | `ReadingSessionNotFinishedError` (NOVO) | criar review numa session que existe e é do usuário, mas não está `finished` | RF-002 |
| `REVIEW_ALREADY_EXISTS` | 409 | `ReviewAlreadyExistsError` (NOVO) | criar uma 2ª review na mesma session | RF-003 |
| `REVIEW_NOT_FOUND` | 404 | `ReviewNotFoundError` (NOVO) | editar/apagar uma `:reviewId` que não existe ou não pertence ao usuário | RF-008 |
| `INTERNAL_ERROR` | 500 | — (genérico da 001) | qualquer erro não `instanceof AppError` | — |

## Invariantes

- Nenhuma resposta de erro inclui detalhe cru do driver `mongodb`.
- `READING_SESSION_NOT_FOUND` e `REVIEW_NOT_FOUND` são devolvidos tanto para um recurso
  inexistente quanto para um que existe mas pertence a outro usuário — nenhuma distinção na
  mensagem (D7/D9, mesmo padrão de `FOLLOW_NOT_FOUND` na 004 e `READING_SESSION_NOT_FOUND` na
  003). Nunca `403`.
- `READING_SESSION_NOT_FINISHED` e `REVIEW_ALREADY_EXISTS` têm `code` distintos mesmo sendo os
  dois `409` — o cliente nunca precisa inspecionar a mensagem para diferenciar as duas
  condições (D3 do `research.md`).
- Apagar uma review já apagada (ou nunca existente): `REVIEW_NOT_FOUND`, mesmo tratamento de
  "nunca existiu".
- Apagar uma `ReadingSession` que tem review nunca retorna erro por causa da review — a
  exclusão em cascata (RF-007) é silenciosa e não observável na resposta de
  `DELETE /v1/reading-sessions/:sessionId` (já existente, 003).
- `details` só aparece em `VALIDATION_ERROR`.
- Todo `code` casa com `^[A-Z][A-Z0-9_]*$` (schema da 001).
