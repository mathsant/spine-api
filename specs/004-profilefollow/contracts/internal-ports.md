# Contratos internos (ports) — Profile & Follow

Interfaces TypeScript que as camadas expõem umas às outras. Nomes em inglês; caminhos seguem
`.specify/memory/architecture.md`. Fluxo unidirecional: controller → service → repository; só
`repositories/**`, `db/**` tocam o driver `mongodb`.

---

## `UserRepository` — `src/repositories/users/user.repository.ts` (extensão da 002)

Dois métodos novos; interface e implementação (`MongoUserRepository`) já existem.

```ts
export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  handle: string;
  displayName: string;
  bio: string | null;              // NOVO
  createdAt: Date;
  updatedAt: Date;
}

export interface UpdateProfileInput {
  displayName?: string;
  bio?: string | null;
}

export interface UserSearchResult {
  id: string;
  handle: string;
  displayName: string;
}

export interface UserSearchPage {
  items: UserSearchResult[];
  page: number;
  limit: number;
  totalItems: number;
}

export interface UserRepository {
  // ...métodos já existentes (create, findByEmail, findByHandle, findById, updatePasswordHash)

  /** $set parcial (só as chaves presentes em `patch`) + updatedAt (D1, RF-002). */
  updateProfile(id: string, patch: UpdateProfileInput, now: Date): Promise<UserRecord>;

  /** $text search por displayName/handle, ordenado por textScore, paginado por página (D2/D3). */
  search(query: string, page: number, limit: number): Promise<UserSearchPage>;
}
```

Registro Awilix: `userRepository` (já existe, sem mudança de nome).

---

## `FollowRequestRepository` — `src/repositories/follow-requests/follow-request.repository.ts`

Port de acesso a `follow_requests`. Registro Awilix: `followRequestRepository`.

```ts
export interface FollowRequestRecord {
  id: string;
  requesterId: string;
  targetId: string;
  createdAt: Date;
}

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}

export interface FollowRequestRepository {
  /**
   * Insere um pedido pendente. Se violar o índice único (requesterId+targetId, código
   * 11000), busca e devolve o pedido já existente em vez de propagar o erro (RF-008,
   * mesmo padrão de `startReading` na 003, D5 de lá).
   */
  create(requesterId: string, targetId: string, now: Date): Promise<FollowRequestRecord>;

  findByPair(requesterId: string, targetId: string): Promise<FollowRequestRecord | null>;

  /** deleteOne pelo par; devolve null se não achou (RF-009/RF-010/RF-012, D7). */
  deleteByPair(requesterId: string, targetId: string): Promise<FollowRequestRecord | null>;

  /** Cursor por createdAt desc, filtrado por requesterId OU targetId (D6). */
  listByTarget(targetId: string, cursor: string | null, limit: number): Promise<CursorPage<FollowRequestRecord>>;
  listByRequester(requesterId: string, cursor: string | null, limit: number): Promise<CursorPage<FollowRequestRecord>>;
}
```

Implementação: `MongoFollowRequestRepository` em `mongo-follow-request.repository.ts`.

---

## `FollowRepository` — `src/repositories/follows/follow.repository.ts`

Port de acesso a `follows`. Registro Awilix: `followRepository`.

```ts
export interface FollowRecord {
  id: string;
  followerId: string;
  followeeId: string;
  createdAt: Date;
}

export interface FollowRepository {
  /** Chamado só pelo fluxo de aprovação (RF-010). */
  create(followerId: string, followeeId: string, now: Date): Promise<FollowRecord>;

  exists(followerId: string, followeeId: string): Promise<boolean>;

  /** deleteOne pelo par; devolve null se não achou (RF-014/RF-015, D7). */
  deleteByPair(followerId: string, followeeId: string): Promise<FollowRecord | null>;

  /** Cursor por createdAt desc — seguidores de `followeeId` (RF-018). */
  listByFollowee(followeeId: string, cursor: string | null, limit: number): Promise<CursorPage<FollowRecord>>;
  /** Cursor por createdAt desc — quem `followerId` segue (RF-019). */
  listByFollower(followerId: string, cursor: string | null, limit: number): Promise<CursorPage<FollowRecord>>;
}
```

Implementação: `MongoFollowRepository` em `mongo-follow.repository.ts`.

---

## Services — `src/services/profile/`

Cobertos por **teste de integração** com `mongodb-memory-server` — caminho feliz + ≥1 de erro.

```ts
// edit-profile.service.ts — makeEditProfile({ userRepository })
export type EditProfile = (input: { userId: string; displayName?: string; bio?: string | null }) => Promise<ProfileDTO>;
// userRepository.updateProfile(userId, { displayName, bio }, clock.now()) -> toProfileDTO.
```

Registro Awilix: `editProfileService`.

---

## Services — `src/services/users/`

```ts
// search-users.service.ts — makeSearchUsers({ userRepository })
export type SearchUsers = (input: { q: string; page: number; limit: number }) => Promise<UserSearchPageDTO>;
// delega a userRepository.search; monta avatarUrl: null em cada item (D9).
```

Registro Awilix: `searchUsersService`.

---

## Services — `src/services/follows/`

```ts
// send-follow-request.service.ts — makeSendFollowRequest({ userRepository, followRepository, followRequestRepository, clock })
// Devolve FollowRequestCreationDTO ({ requesterId, targetId, createdAt }), não FollowRequestDTO
// (que é a forma de listagem, com handle/displayName/direction) — bate com o schema
// FollowRequestResource do openapi (achado do /analyze, D-fix registrado em data-model.md).
export type SendFollowRequest = (input: { requesterId: string; targetId: string }) => Promise<{ request: FollowRequestCreationDTO; created: boolean }>;
// requesterId === targetId -> CannotFollowSelfError (RF-006).
// userRepository.findById(targetId) === null -> NotFoundError (RF-005).
// followRepository.exists(requesterId, targetId) -> AlreadyFollowingError (RF-007).
// followRequestRepository.create(...) -> `created` diferencia 201 (nova) de 200 (já pendente, RF-008).

// cancel-follow-request.service.ts — makeCancelFollowRequest({ followRequestRepository })
export type CancelFollowRequest = (input: { requesterId: string; targetId: string }) => Promise<void>;
// deleteByPair(requesterId, targetId) === null -> FollowRequestNotFoundError (RF-009).

// approve-follow-request.service.ts — makeApproveFollowRequest({ followRequestRepository, followRepository, clock })
export type ApproveFollowRequest = (input: { targetId: string; requesterId: string }) => Promise<void>;
// deleteByPair(requesterId, targetId) === null -> FollowRequestNotFoundError (RF-016).
// achou -> followRepository.create(requesterId, targetId, clock.now()) (RF-010/RF-011).

// reject-follow-request.service.ts — makeRejectFollowRequest({ followRequestRepository })
export type RejectFollowRequest = (input: { targetId: string; requesterId: string }) => Promise<void>;
// deleteByPair(requesterId, targetId) === null -> FollowRequestNotFoundError (RF-016). Sem criar Follow (RF-012/RF-013).

// unfollow.service.ts — makeUnfollow({ followRepository })
export type Unfollow = (input: { followerId: string; followeeId: string }) => Promise<void>;
// deleteByPair(followerId, followeeId) === null -> FollowNotFoundError (RF-014/RF-017).

// remove-follower.service.ts — makeRemoveFollower({ followRepository })
export type RemoveFollower = (input: { followeeId: string; followerId: string }) => Promise<void>;
// deleteByPair(followerId, followeeId) === null -> FollowNotFoundError (RF-015/RF-017).

// list-follow-requests.service.ts — makeListFollowRequests({ followRequestRepository, userRepository })
export type ListFollowRequests = (input: {
  userId: string; direction: 'incoming' | 'outgoing'; cursor: string | null; limit: number;
}) => Promise<FollowRequestCursorPageDTO>;
// direction incoming -> listByTarget(userId, ...); outgoing -> listByRequester(userId, ...).
// resolve o outro lado via userRepository.findById em lote -> monta DTO com handle/displayName.

// list-followers.service.ts — makeListFollowers({ followRepository, userRepository })
export type ListFollowers = (input: { userId: string; cursor: string | null; limit: number }) => Promise<FollowCursorPageDTO>;
// followRepository.listByFollowee(userId, ...) -> resolve followerId em lote -> DTO (RF-018/RF-020).

// list-following.service.ts — makeListFollowing({ followRepository, userRepository })
export type ListFollowing = (input: { userId: string; cursor: string | null; limit: number }) => Promise<FollowCursorPageDTO>;
// followRepository.listByFollower(userId, ...) -> resolve followeeId em lote -> DTO (RF-019/RF-020).
```

Registros Awilix: `sendFollowRequestService`, `cancelFollowRequestService`,
`approveFollowRequestService`, `rejectFollowRequestService`, `unfollowService`,
`removeFollowerService`, `listFollowRequestsService`, `listFollowersService`,
`listFollowingService`.

---

## HTTP — `src/controllers/profile/`, `src/controllers/users/`, `src/controllers/follows/`

Todas as rotas com `preHandler: app.authenticate` (RF-021).

- `profile.routes.ts`, `{ prefix: '/v1' }`:
  - `PATCH /me` → `edit-profile.controller.ts` (resolve `editProfileService`)
- `users.routes.ts`, `{ prefix: '/v1' }`:
  - `GET /users/search` → `search-users.controller.ts`
- `follows.routes.ts`, `{ prefix: '/v1' }`:
  - `POST   /users/:userId/follow-request` → `send-follow-request.controller.ts` (200/201 conforme `created`)
  - `DELETE /users/:userId/follow-request` → `cancel-follow-request.controller.ts`
  - `POST   /users/:userId/follow-request/approve` → `approve-follow-request.controller.ts`
  - `POST   /users/:userId/follow-request/reject` → `reject-follow-request.controller.ts`
  - `DELETE /users/:userId/follow` → `unfollow.controller.ts`
  - `DELETE /users/:userId/follower` → `remove-follower.controller.ts`
  - `GET    /me/follow-requests` → `list-follow-requests.controller.ts`
  - `GET    /me/followers` → `list-followers.controller.ts`
  - `GET    /me/following` → `list-following.controller.ts`

Cada controller: valida entrada com o schema `zod` do domínio (P3), resolve o service do
`request.diScope`, injeta `request.currentUser.id` (RF-021), chama, responde.

Registro Awilix novo em `register-repositories.ts` (`followRequestRepository`,
`followRepository`; `userRepository` só ganha métodos, sem novo registro) e
`register-services.ts` (os 10 services novos: `editProfileService`, `searchUsersService` +
os 9 de `follows`). `cradle.ts` ganha os tipos.
