# Modelo de Dados — Fase 1 (`011-userconnectionscontractgaps`)

**Nenhuma entidade nova. Nenhuma coleção nova. Nenhuma mudança de documento persistido. Nenhuma migração de dados.**

Esta feature adiciona: DTOs de resposta, campos em DTOs de lista existentes, métodos de repositório de leitura, e **um** índice.

---

## 1. DTOs novos

### `UserProfileDTO` — resposta de `GET /users/{userId}` (`src/services/users/types.ts`)

| Campo | Tipo | Regra |
|---|---|---|
| `id` | `string` | id interno do alvo (24-hex) |
| `handle` | `string` | sempre presente |
| `displayName` | `string` | sempre presente |
| `avatarUrl` | `string \| null` | **sempre `null`** nesta versão (upload de avatar não existe) |
| `bio` | `string \| null` | texto real **só** quando `followState === 'following'`; senão `null` |
| `followState` | `'none' \| 'pending' \| 'following'` | viewer → alvo (ver regra abaixo) |
| `followsYou` | `boolean` | alvo → viewer, follow **aprovado** |

Regra de `followState` (compartilhada com D4):
- `following` — existe follow aprovado viewer→alvo;
- senão `pending` — existe follow request pendente viewer→alvo;
- senão `none`.
- Se (impossível no fluxo normal) houver os dois, `following` vence.
- Para `GET /users/{meuId}` (viewer === alvo): `followState = 'none'`, `followsYou = false`, `bio = null`.

### `MyStatsDTO` — resposta de `GET /me/stats` (`src/services/profile/types.ts`)

| Campo | Tipo | Definição |
|---|---|---|
| `booksRead` | `integer >= 0` | nº de `bookId` distintos com ≥1 `reading_session` `status: 'finished'` do usuário |
| `followers` | `integer >= 0` | follows aprovados com `followeeId = usuário` |
| `following` | `integer >= 0` | follows aprovados com `followerId = usuário` |
| `pendingFollowRequests` | `integer >= 0` | follow requests pendentes com `targetId = usuário` (recebidos) |
| `wantToRead` | `integer >= 0` | shelf memberships do usuário |

### Item de `GET /users/{userId}/activity`

Reutiliza `FeedItemDTO` / `FeedCursorPageDTO` de `src/services/feed/types.ts` **sem alteração**. Resposta: `{ items: FeedItemDTO[], nextCursor: string | null }`.

---

## 2. Campos adicionados a DTOs existentes (D4)

Ambos os campos com a mesma semântica de `UserProfileDTO`. Passam a ser **obrigatórios** no schema publicado.

| DTO | Arquivo | Campos adicionados | Observação |
|---|---|---|---|
| `UserSearchResultDTO` | `src/services/users/types.ts` | `followState`, `followsYou` | item de `GET /users/search` |
| `FollowedUserDTO` | `src/services/follows/types.ts` | `followState`, `followsYou` | itens de `GET /me/followers` e `GET /me/following`; em `following` `followState` é sempre `following`; em `followers` `followsYou` é sempre `true` |
| `FollowRequestDTO` | `src/services/follows/types.ts` | `followState`, `followsYou` | itens de `GET /me/follow-requests`; em `outgoing` `followState` é sempre `pending` |

O `userId` de cada item é o "outro lado" (já é assim hoje). `followState`/`followsYou` são sempre relativos ao **usuário autenticado**.

---

## 3. Métodos de repositório novos (interface + implementação `mongo-*`)

Todos são **leitura**. Projeções mínimas. Sem exceção crua do driver (queries simples).

### `FollowRepository` (`src/repositories/follows/`)

```ts
/** Subconjunto de candidateIds que followerId segue com follow aprovado. Array vazio → [] sem tocar o banco. */
filterFollowing(followerId: string, candidateIds: string[]): Promise<string[]>;

/** Subconjunto de candidateIds que seguem followeeId com follow aprovado. Array vazio → [] sem tocar o banco. */
filterFollowers(followeeId: string, candidateIds: string[]): Promise<string[]>;

/** nº de follows aprovados com followeeId = userId. */
countFollowers(userId: string): Promise<number>;

/** nº de follows aprovados com followerId = userId. */
countFollowing(userId: string): Promise<number>;
```

- `filterFollowing`: `find({ followerId, followeeId: { $in: candidateIds } }, { projection: { followeeId: 1, _id: 0 } })` → `map(d => d.followeeId)`. Índice `follows_followerId_followeeId_unique`.
- `filterFollowers`: `find({ followeeId, followerId: { $in: candidateIds } }, { projection: { followerId: 1, _id: 0 } })` → `map(d => d.followerId)`. Índice **novo** `follows_followeeId_followerId`.
- `countFollowers`/`countFollowing`: `countDocuments`. Índices `follows_followeeId_createdAt` / `follows_followerId_createdAt` (prefixo).

### `FollowRequestRepository` (`src/repositories/follow-requests/`)

```ts
/** Subconjunto de candidateIds para os quais requesterId tem follow request pendente. Vazio → []. */
filterPendingTargets(requesterId: string, candidateIds: string[]): Promise<string[]>;

/** nº de follow requests pendentes com targetId = userId (recebidos). */
countIncoming(userId: string): Promise<number>;
```

- `filterPendingTargets`: `find({ requesterId, targetId: { $in: candidateIds } }, { projection: { targetId: 1, _id: 0 } })`. Índice `follow_requests_requesterId_targetId_unique`.
- `countIncoming`: `countDocuments({ targetId: userId })`. Índice `follow_requests_targetId_createdAt` (prefixo).

### `ReadingSessionRepository` (`src/repositories/reading-sessions/`)

```ts
/** nº de bookId distintos com >= 1 session finished deste usuário. */
countDistinctFinishedBooks(userId: string): Promise<number>;
```

- `(await collection.distinct('bookId', { userId, status: 'finished' })).length`. Índice `reading_sessions_userId_status_createdAt` (prefixo `userId + status`). Espelha o já existente `countDistinctFinishedReaders(bookId)`.

### `ShelfMembershipRepository` (`src/repositories/shelf-memberships/`)

```ts
/** nº de marcações want-to-read do usuário. */
countForUser(userId: string): Promise<number>;
```

- `countDocuments({ userId })`. Índice `shelf_memberships_userId_bookId_unique` (prefixo `userId`).

### `ActivityRepository`

**Sem método novo.** `GET /users/{userId}/activity` usa `listForActors([targetId], cursor, limit)`.

### `UserRepository`

**Sem método novo.** `findById` já existe e já trata `ObjectId` inválido.

---

## 4. Índice novo (1 migration `migrate-mongo`)

`migrations/<timestamp>-add-userconnections-followsYou-index.js`

```js
async up(db) {
  // Lote de followsYou (GET /users/:userId, DTOs de lista): { followeeId: me, followerId: { $in: [...] } }
  await db.collection('follows').createIndex(
    { followeeId: 1, followerId: 1 },
    { name: 'follows_followeeId_followerId' },
  );
}
async down(db) {
  await db.collection('follows').dropIndex('follows_followeeId_followerId');
}
```

Não único (o par único já é garantido por `follows_followerId_followeeId_unique`). Reversível. Nenhuma transformação de documento.

---

## 5. Erro novo

`src/errors/user-not-found-error.ts`

```ts
export class UserNotFoundError extends AppError {
  constructor(message = 'User not found') {
    super('USER_NOT_FOUND', 404, message);
  }
}
```

Exportado em `src/errors/index.ts`. Sem mudança no `error-handler.ts` (mapeia `instanceof AppError`).

Usado por: `makeGetUserProfile` (alvo inexistente/malformado) e `makeListUserActivity` (alvo inexistente/malformado **ou** viewer sem follow aprovado e não é o próprio) — corpo/status idênticos nos dois gatilhos (P6).
