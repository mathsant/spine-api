# Contratos internos (ports) — Autenticação e Cadastro

Interfaces TypeScript que as camadas expõem umas às outras. Nomes em inglês; caminhos
seguem `.specify/memory/architecture.md`. Fluxo unidirecional: controller → service →
repository; só `repositories/**` e `db/**` tocam o driver `mongodb`.

---

## Auth primitives — `src/auth/` (funções puras, sem Fastify, sem Mongo)

`src/auth/` é pasta transversal (como `src/http/` e `src/lifecycle/` da 001): utilidades de
segurança sem estado. Cobertas por **teste unitário**.

### `password.ts`

```ts
/** scrypt N=2^15,r=8,p=1; salt aleatório de 16B; formato scrypt$N$r$p$saltB64$hashB64. */
export function hashPassword(plain: string): Promise<string>;

/** Comparação de tempo constante. Roda o KDF mesmo em stored inválido (anti-timing). */
export function verifyPassword(plain: string, stored: string): Promise<boolean>;
```

### `access-token.ts`

```ts
export const ACCESS_TOKEN_TTL_SECONDS = 900; // 15 min — RF-017

export interface AccessTokenClaims { userId: string }

/** JWT compacto HS256. exp = iat + ACCESS_TOKEN_TTL_SECONDS. */
export function signAccessToken(claims: AccessTokenClaims, secret: string, nowSeconds?: number): string;

/**
 * Valida alg=HS256 (recusa qualquer outro, incl. "none"), assinatura (tempo constante),
 * presença de `sub`, exp > now. Lança `InvalidAccessTokenError` em qualquer falha.
 */
export function verifyAccessToken(token: string, secret: string, nowSeconds?: number): AccessTokenClaims;
```

### `refresh-token.ts`

```ts
export const REFRESH_INACTIVITY_DAYS = 30; // RF-025

/** token = base64url(32B aleatórios); tokenHash = sha256(token) hex. */
export function generateRefreshToken(): { token: string; tokenHash: string };
export function hashRefreshToken(token: string): string;
```

---

## UserRepository — `src/repositories/users/user.repository.ts`

Port de acesso a dados de `users`. Registro Awilix: `userRepository`.

```ts
export interface UserRecord {
  id: string;
  email: string;          // normalizado
  passwordHash: string;
  handle: string;         // normalizado, imutável
  displayName: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserInput {
  email: string;          // já normalizado pelo service
  passwordHash: string;
  handle: string;         // já normalizado pelo service
  displayName: string;
}

export interface UserRepository {
  /**
   * Insere. Em violação de índice único (driver code 11000) traduz para
   * `EmailAlreadyInUseError` (chave email) ou `HandleAlreadyInUseError` (chave handle).
   * Nenhuma exceção crua do driver escapa (P5).
   */
  create(input: CreateUserInput): Promise<UserRecord>;

  findByEmail(email: string): Promise<UserRecord | null>;
  findByHandle(handle: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;

  /** Atualiza passwordHash + updatedAt. */
  updatePasswordHash(id: string, passwordHash: string, now: Date): Promise<void>;
}
```

Implementação: `MongoUserRepository` em `mongo-user.repository.ts`, recebe `db: Db`.

---

## AuthSessionRepository — `src/repositories/auth-sessions/auth-session.repository.ts`

Port do agregado sessão + cadeia de refresh tokens (`auth_sessions` + `refresh_tokens`).
Registro Awilix: `authSessionRepository`.

```ts
export type RevokedReason = 'logout' | 'reuse_detected' | 'password_changed' | 'expired';

export interface AuthSessionRecord {
  sessionId: string;
  userId: string;
  status: 'active' | 'revoked';
  createdAt: Date;
  lastUsedAt: Date;
  inactivityExpiresAt: Date;
  revokedReason?: RevokedReason;
}

export interface RefreshTokenRecord {
  id: string;
  sessionId: string;
  userId: string;
  tokenHash: string;
  createdAt: Date;
  rotatedAt: Date | null;
  expiresAt: Date;
}

export interface CreateSessionInput {
  userId: string;
  refreshTokenHash: string;
  now: Date;
  inactivityExpiresAt: Date;   // now + 30d
  refreshExpiresAt: Date;      // now + 30d (limite duro do elo)
}

export interface RotateInput {
  currentTokenId: string;
  sessionId: string;
  userId: string;
  newTokenHash: string;
  now: Date;
  inactivityExpiresAt: Date;
  refreshExpiresAt: Date;
}

export interface AuthSessionRepository {
  /** Cria a sessão `active` e o primeiro elo de refresh (rotatedAt=null). Retorna o id da sessão. */
  createSession(input: CreateSessionInput): Promise<{ sessionId: string }>;

  /** Elo pelo hash do token cru. `null` se não existe. */
  findRefreshTokenByHash(tokenHash: string): Promise<RefreshTokenRecord | null>;

  findSessionById(sessionId: string): Promise<AuthSessionRecord | null>;

  /**
   * Rotação atômica: updateOne({ _id: currentTokenId, rotatedAt: null }, set rotatedAt=now).
   * Se casou (modifiedCount 1): insere o novo elo e faz touch na sessão
   * (lastUsedAt, inactivityExpiresAt). Retorna { rotated: true }.
   * Se não casou (já rotacionado / corrida): retorna { rotated: false } — o caller trata
   * como reuso.
   */
  rotate(input: RotateInput): Promise<{ rotated: boolean }>;

  /** Marca a sessão revoked + revokedAt + revokedReason. Idempotente. */
  revokeSession(sessionId: string, reason: RevokedReason): Promise<void>;

  /** Revoga todas as sessões `active` do usuário, exceto `exceptSessionId` se dado. */
  revokeAllUserSessions(
    userId: string,
    reason: RevokedReason,
    options?: { exceptSessionId?: string },
  ): Promise<void>;
}
```

Implementação: `MongoAuthSessionRepository` em `mongo-auth-session.repository.ts`, recebe
`db: Db`. Converte exceção crua do driver em `DatabaseUnavailableError` (P5).

---

## Services — `src/services/auth/` (regra de negócio; factory Awilix; um arquivo por operação)

Cobertos por **teste de integração** com `mongodb-memory-server` (caminho feliz + ≥1 de erro).

```ts
// signup.service.ts — makeSignup({ userRepository })
export type Signup = (input: {
  email: string; password: string; handle: string; displayName: string;
}) => Promise<PublicUser>;
// normaliza email/handle; checa unicidade (erros amigáveis) + índice único (corrida);
// hashPassword; create. Não emite tokens.

// login.service.ts — makeLogin({ userRepository, authSessionRepository, config, clock })
export type Login = (input: { email: string; password: string }) => Promise<TokenPair>;
// findByEmail(normalizado); verifyPassword SEMPRE (anti-timing); INVALID_CREDENTIALS nos dois
// casos; createSession; signAccessToken.

// refresh.service.ts — makeRefresh({ userRepository, authSessionRepository, config, clock })
export type Refresh = (input: { refreshToken: string }) => Promise<TokenPair>;
// hashRefreshToken; findRefreshTokenByHash; regras D4 (INVALID / EXPIRED / REUSE_DETECTED);
// rotate atômico; signAccessToken.

// logout.service.ts — makeLogout({ authSessionRepository })
export type Logout = (input: { refreshToken: string }) => Promise<void>;
// hash; findRefreshTokenByHash; se achou → revokeSession(sessionId, 'logout'); sempre resolve
// (idempotente).

// change-password.service.ts — makeChangePassword({ userRepository, authSessionRepository, clock })
export type ChangePassword = (input: {
  userId: string; currentPassword: string; newPassword: string; refreshToken?: string;
}) => Promise<void>;
// verifyPassword(currentPassword) → INVALID_CREDENTIALS se falhar; updatePasswordHash;
// resolve exceptSessionId a partir do refreshToken (se válido p/ este userId);
// revokeAllUserSessions(userId, 'password_changed', { exceptSessionId }).

// authenticate.service.ts — makeAuthenticate({ userRepository, config })
export type Authenticate = (accessToken: string) => Promise<PublicUser>;
// verifyAccessToken(secret) → { userId }; findById; INVALID_ACCESS_TOKEN se token inválido
// ou conta inexistente. Retorna a representação pública (vira request.currentUser).

export interface PublicUser {
  id: string; email: string; handle: string; displayName: string; createdAt: Date;
}
export interface TokenPair {
  accessToken: string; refreshToken: string; tokenType: 'Bearer'; expiresIn: number;
}
```

Registros Awilix: `signupService`, `loginService`, `refreshService`, `logoutService`,
`changePasswordService`, `authenticateService`. `clock` (`asValue({ now: () => new Date() })`)
entra em `register-infrastructure` para tornar expiração testável sem `sleep`.

---

## HTTP — `src/http/authenticate.ts`

```ts
declare module 'fastify' {
  interface FastifyRequest { currentUser?: PublicUser }
  interface FastifyInstance { authenticate: preHandlerHookHandler }
}

/**
 * Decora `app.authenticate` (preHandler): lê `Authorization: Bearer <t>`; header ausente /
 * esquema ≠ Bearer / valor vazio → lança `UnauthenticatedError`. Senão resolve
 * `authenticateService` do request.diScope, popula `request.currentUser`.
 */
export function registerAuthentication(app: FastifyInstance): void;
```

Parsing do header = função de borda → **teste unitário**; o caminho com banco (conta
existe/não existe) é exercido pelo teste de integração de `authenticate.service` e pelo
`app.inject()` de `GET /me`.

---

## HTTP — `src/controllers/auth/`

- `auth.routes.ts` — plugin Fastify do domínio, registrado em `app.ts` com `{ prefix: '/v1' }`:
  - `POST /auth/signup`  → `signup.controller.ts`  (+ `config.rateLimit` por IP)
  - `POST /auth/login`   → `login.controller.ts`   (+ `config.rateLimit` por IP+email, `hook: 'preHandler'`)
  - `POST /auth/refresh` → `refresh.controller.ts`
  - `POST /auth/logout`  → `logout.controller.ts`
  - `POST /auth/change-password` → `change-password.controller.ts` (`preHandler: app.authenticate`)
  - `GET  /me`           → `get-me.controller.ts` (`preHandler: app.authenticate`)
- Cada controller: valida o corpo com o schema `zod` do domínio (P3), resolve o service do
  `request.diScope`, chama, responde (`201`/`200`/`204`) ou deixa o erro subir ao handler
  global.
- `get-me.controller.ts` apenas responde `200` com `request.currentUser` (sem service).

Registro Awilix novo em `register-repositories.ts` (`userRepository`,
`authSessionRepository`) e `register-services.ts` (os 6 services). `cradle.ts` ganha os
tipos.
