# Códigos de erro — Autenticação e Cadastro

Todos serializados no envelope único da 001:
`{ "error": { "code", "message", "statusCode", "details?" } }`
(schema em `specs/001-backendappsetup/contracts/error-response.schema.json`).

| `code` | HTTP | Classe (`src/errors/*.error.ts`) | Origem | Spec |
|---|---|---|---|---|
| `VALIDATION_ERROR` | 400 | `ValidationError` (da 001) | qualquer corpo reprovado por schema `zod`; `details` = campos inválidos | RF-039 |
| `EMAIL_ALREADY_IN_USE` | 409 | `EmailAlreadyInUseError` | `signup`: e-mail normalizado já existe (checagem ou índice único 11000) | RF-006, RF-008, RF-040 |
| `HANDLE_ALREADY_IN_USE` | 409 | `HandleAlreadyInUseError` | `signup`: handle normalizado já existe | RF-007, RF-008, RF-040 |
| `INVALID_CREDENTIALS` | 401 | `InvalidCredentialsError` | `login` (e-mail inexistente **ou** senha errada — msg idêntica); `change-password` (senha atual errada) | RF-014, RF-034 |
| `UNAUTHENTICATED` | 401 | `UnauthenticatedError` | rota protegida sem `Authorization` / esquema ≠ `Bearer` / `Bearer` vazio | RF-019 |
| `INVALID_ACCESS_TOKEN` | 401 | `InvalidAccessTokenError` | access token expirado / malformado / assinatura inválida / `alg` ≠ HS256 / conta inexistente | RF-016, RF-018 |
| `INVALID_REFRESH_TOKEN` | 401 | `InvalidRefreshTokenError` | `refresh`: token desconhecido, forjado, ou de sessão já revogada (logout / troca de senha / reuso) | RF-027 |
| `REFRESH_TOKEN_EXPIRED` | 401 | `RefreshTokenExpiredError` | `refresh`: sessão inativa há mais de 30 dias | RF-025 |
| `REFRESH_TOKEN_REUSE_DETECTED` | 401 | `RefreshTokenReuseDetectedError` | `refresh`: elo já rotacionado reapresentado (ou corrida) → a sessão inteira é revogada | RF-026 |
| `TOO_MANY_REQUESTS` | 429 | `TooManyRequestsError` (retornada pelo `errorResponseBuilder` do `@fastify/rate-limit` como `AppError`, para o mesmo envelope quer o plugin a envie no hook `onRequest`, quer a lance no `preHandler`) | `login` / `signup` acima do limite na janela | RF-037, RF-038 |
| `INTERNAL_ERROR` | 500 | — (genérico da 001) | qualquer erro não `instanceof AppError`; corpo genérico, sem stack, sem detalhe do driver | RF-039 |

## Invariantes

- Nenhuma resposta de erro inclui `passwordHash`, token, stack trace ou mensagem crua do
  driver `mongodb` (RF-027 da 001, RF-042).
- `INVALID_CREDENTIALS` tem **exatamente** a mesma `message` para "e-mail não existe" e
  "senha errada"; `login` roda `verifyPassword` mesmo quando o usuário não é encontrado
  (RF-014).
- Todo `code` casa com `^[A-Z][A-Z0-9_]*$` (schema da 001).
- `details` só aparece em `VALIDATION_ERROR`.
