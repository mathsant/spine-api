# Fase 1 — Modelo de Dados: Autenticação e Cadastro

Feature: `002-authregistration` · Data: 2026-09-03

Todos os identificadores em inglês (regra fixa do kit). Persistência via MongoDB; toda
criação de coleção/índice vem de uma migration `migrate-mongo` (P4). Nenhum acesso ao driver
fora de `src/repositories/**` e `src/db/**` (P2).

---

## User

Conta de uma pessoa (o mesmo `User` do glossário de `product.md`, criado aqui pelo cadastro).
Coleção `users`.

| Campo | Tipo | Obrigatório | Regra / origem |
|---|---|---|---|
| `_id` | `ObjectId` | sim | gerado pelo Mongo; exposto às camadas como `id: string` (hex) |
| `email` | `string` | sim | **normalizado**: `trim().toLowerCase()`; e-mail sintaticamente válido; **único** |
| `passwordHash` | `string` | sim | `scrypt$<N>$<r>$<p>$<saltB64>$<hashB64>` (D1); nunca sai em DTO nem em log |
| `handle` | `string` | sim | **normalizado**: `toLowerCase()`; `^[a-z0-9_]{3,30}$` após normalizar (entrada aceita `[A-Za-z0-9_]` — D9); **único**; **imutável** (P11) |
| `displayName` | `string` | sim | `trim()`; 1–50 chars; preserva a caixa digitada |
| `createdAt` | `Date` | sim | definido na criação |
| `updatedAt` | `Date` | sim | atualizado em `change-password` |

**Índices** (migration `create-users-collection`):
- `{ email: 1 }` único
- `{ handle: 1 }` único

**Representação pública** (resposta de `signup` e base do `GET /v1/me`):
`{ id, email, handle, displayName, createdAt }`. **Nunca** inclui `passwordHash`.

**Regras**:
- `create` no repositório captura violação de índice único do driver (`code 11000`) e a
  traduz: chave `email` → `EmailAlreadyInUseError`; chave `handle` → `HandleAlreadyInUseError`
  (P5, RF-040). Isso cobre a corrida de cadastro simultâneo (RF-008).
- `findByEmail(email)` recebe o e-mail **já normalizado** pelo service.

---

## AuthSession

Uma sessão = um login (P12). Agrupa a cadeia de refresh tokens rotacionados. Coleção
`auth_sessions`.

| Campo | Tipo | Obrigatório | Regra |
|---|---|---|---|
| `_id` | `ObjectId` | sim | exposto como `sessionId: string` |
| `userId` | `ObjectId` | sim | dono da sessão |
| `status` | `'active' \| 'revoked'` | sim | começa `active` |
| `createdAt` | `Date` | sim | instante do login |
| `lastUsedAt` | `Date` | sim | atualizado a cada `refresh` bem-sucedido |
| `inactivityExpiresAt` | `Date` | sim | `lastUsedAt + 30 dias`; renovado a cada `refresh` (RF-024) |
| `revokedAt` | `Date` | não | preenchido quando `status` vira `revoked` |
| `revokedReason` | `'logout' \| 'reuse_detected' \| 'password_changed' \| 'expired'` | não | motivo da revogação |

**Índices** (migration `create-auth-sessions-collection`):
- `{ userId: 1 }`

**Regras**:
- `inactivityExpiresAt <= now` no momento de um `refresh` ⇒ `RefreshTokenExpiredError` (401)
  e a sessão é marcada `revoked`/`expired` (RF-025).
- Uma sessão `revoked` nunca volta a `active`. Qualquer `refresh` sobre ela ⇒
  `InvalidRefreshTokenError` (401) (RF-027).
- `revokeAllUserSessions(userId, { exceptSessionId? })` usado por `change-password` (RF-036).

---

## RefreshToken

Um elo da cadeia de rotação de uma `AuthSession` (D3, D4). Coleção `refresh_tokens`.

| Campo | Tipo | Obrigatório | Regra |
|---|---|---|---|
| `_id` | `ObjectId` | sim | id interno do elo |
| `sessionId` | `ObjectId` | sim | sessão à qual o elo pertence |
| `userId` | `ObjectId` | sim | desnormalizado (evita lookup em `logout`) |
| `tokenHash` | `string` | sim | `sha256(rawToken)` em hex; **único** |
| `createdAt` | `Date` | sim | emissão do elo |
| `rotatedAt` | `Date \| null` | sim | `null` = elo corrente; `Date` = já trocado por outro |
| `expiresAt` | `Date` | sim | `createdAt + 30 dias` (limite duro do elo) |

**Índices** (migration `create-refresh-tokens-collection`):
- `{ tokenHash: 1 }` único
- `{ sessionId: 1 }`

**Regras**:
- O token cru (`base64url` de 32 bytes) **nunca** é persistido — só o `tokenHash`.
- Rotação é um `updateOne({ _id, rotatedAt: null }, { $set: { rotatedAt: now } })`.
  `modifiedCount === 0` ⇒ o elo já fora rotacionado (reuso ou corrida) ⇒
  `RefreshTokenReuseDetectedError` (401) + `revokeSession(..., 'reuse_detected')` (RF-026 +
  caso de borda de corrida da spec).
- Apresentar um elo com `rotatedAt != null` ⇒ mesmo tratamento de reuso.

---

## AccessToken *(não persistido)*

JWT compacto `HS256` (D2). Assinado com `ACCESS_TOKEN_SECRET`.

| Claim | Valor |
|---|---|
| `sub` | `user.id` (hex) |
| `iat` | epoch (s) da emissão |
| `exp` | `iat + 900` (15 min — RF-017, `ACCESS_TOKEN_TTL_SECONDS`) |

`verifyAccessToken` recusa qualquer `alg` ≠ `HS256` (incl. `none`), assinatura inválida
(comparação de tempo constante), ausência de `sub`, ou `exp <= now`. Falha ⇒
`InvalidAccessTokenError` (401).

---

## Objetos de valor (schemas de entrada — `src/schemas/auth/`)

Validados por `zod` no controller antes de qualquer service (P3).

| Schema | Campos | Regras |
|---|---|---|
| `signup` | `email`, `password`, `handle`, `displayName` | `email` e-mail válido; `password` 8–72 chars; `handle` `^[A-Za-z0-9_]{3,30}$`; `displayName` 1–50 após `trim` |
| `login` | `email`, `password` | `email` e-mail válido; `password` string não vazia |
| `refresh` | `refreshToken` | string não vazia |
| `logout` | `refreshToken` | string não vazia |
| `changePassword` | `currentPassword`, `newPassword`, `refreshToken?` | `newPassword` 8–72 chars; `refreshToken` opcional (string não vazia se presente) |

Falha de qualquer schema ⇒ `ZodError` → `ValidationError` (`400 VALIDATION_ERROR`, com
`details`) pelo error handler global já existente (001).

---

## Hierarquia de erros — subtipos novos

Todos estendem `AppError` (`src/errors/app-error.ts`), `code` em `SCREAMING_SNAKE_CASE`
(P5). Serializados no envelope único `{ error: { code, message, statusCode, details? } }`
(contrato da 001).

| Classe | `code` | `statusCode` | Quando |
|---|---|---|---|
| `EmailAlreadyInUseError` | `EMAIL_ALREADY_IN_USE` | `409` | e-mail normalizado já existe (checagem ou índice único) |
| `HandleAlreadyInUseError` | `HANDLE_ALREADY_IN_USE` | `409` | handle normalizado já existe |
| `InvalidCredentialsError` | `INVALID_CREDENTIALS` | `401` | login com e-mail/senha errados; `change-password` com senha atual errada — mensagem genérica idêntica (RF-014, RF-034) |
| `UnauthenticatedError` | `UNAUTHENTICATED` | `401` | rota protegida sem header `Authorization` / esquema ≠ `Bearer` / `Bearer` vazio (RF-019) |
| `InvalidAccessTokenError` | `INVALID_ACCESS_TOKEN` | `401` | access token expirado, malformado, assinatura inválida, ou conta inexistente (RF-018) |
| `InvalidRefreshTokenError` | `INVALID_REFRESH_TOKEN` | `401` | refresh token desconhecido / de sessão já revogada (RF-027) |
| `RefreshTokenExpiredError` | `REFRESH_TOKEN_EXPIRED` | `401` | sessão inativa há mais de 30 dias (RF-025) |
| `RefreshTokenReuseDetectedError` | `REFRESH_TOKEN_REUSE_DETECTED` | `401` | elo já rotacionado reapresentado; revoga a sessão inteira (RF-026) |

`TOO_MANY_REQUESTS` (`429`, RF-037/038): o `errorResponseBuilder` do `@fastify/rate-limit`
retorna um `TooManyRequestsError` (subtipo de `AppError`) — assim o envelope é o mesmo quer o
plugin envie a resposta (hook `onRequest`, usado no `signup`), quer a lance (hook
`preHandler`, usado no `login` para ler o corpo). `INTERNAL_ERROR` (`500`) segue como o
genérico da 001 para qualquer erro não `instanceof AppError`.

---

## Diagrama de relações

```
User (1) ──< AuthSession (N)        userId
AuthSession (1) ──< RefreshToken (N)   sessionId   (cadeia de rotação; 1 com rotatedAt=null)
User (1) ──< RefreshToken (N)        userId (desnormalizado)
```
