# Fase 1 — Modelo de Dados: Profile & Follow

Feature: `004-profilefollow` · Data: 2026-09-04

Todos os identificadores em inglês (regra fixa do kit). Persistência via MongoDB; toda
criação/alteração de coleção/índice vem de uma migration `migrate-mongo` (P4 da
constituição). Nenhum acesso ao driver fora de `src/repositories/**` e `src/db/**` (P2).

---

## User (extensão — coleção `users` já existe desde a 002)

Ganha um campo novo. Nenhuma migration de `createCollection`/índice — só um `updateMany` de
backfill (`bio: null` nos documentos existentes) é opcional e não obrigatório, já que campo
ausente e `null` são equivalentes nas leituras (`?? null` no repository).

| Campo novo | Tipo | Obrigatório | Regra / origem |
|---|---|---|---|
| `bio` | `string \| null` | não | texto curto opcional, `trim`, máx. 280 chars (D8 do `research.md`); editável via `PATCH /v1/me` (RF-002) |

Campos existentes relevantes a esta feature (sem mudança de tipo): `displayName` (passa a ser
**editável** por `PATCH /v1/me`, RF-002), `handle` (permanece **imutável**, RF-003 — nenhum
endpoint desta feature aceita `handle` no corpo).

**Índices novos** (migration `add-users-text-search-index`):
- `{ displayName: 'text', handle: 'text' }` — suporta `GET /v1/users/search` (D2)

**Regras**:
- `updateProfile(id, patch, now)` (método novo do `UserRepository`): `updateOne({ _id }, { $set: { ...patch, updatedAt: now } })`; `patch` só contém as chaves realmente enviadas (`displayName`/`bio`), nunca `handle`/`email`/`passwordHash`.
- `search(query, page, limit)` (método novo do `UserRepository`): `find({ $text: { $search: query } }, { projection: { score: { $meta: 'textScore' } } }).sort({ score: { $meta: 'textScore' } })`, com `skip`/`limit` para a página (D3).

---

## FollowRequest

Pedido de follow pendente (glossário de `product.md`). Coleção `follow_requests`. Existe só
enquanto pendente — é **apagado** (não marcado) ao ser aprovado, recusado ou cancelado
(RF-009, RF-010, RF-012, RF-013).

| Campo | Tipo | Obrigatório | Regra / origem |
|---|---|---|---|
| `_id` | `ObjectId` | sim | exposto como `id: string` |
| `requesterId` | `ObjectId` | sim | quem enviou o pedido (referência a `users._id`) |
| `targetId` | `ObjectId` | sim | quem recebeu o pedido |
| `createdAt` | `Date` | sim | instante do envio; chave de ordenação/cursor (D3 do `research.md`, mesma mecânica de `want_to_read`) |

**Índices** (migration `create-follow-requests-collection`):
- `{ requesterId: 1, targetId: 1 }` único composto — no máximo um pedido pendente por par ordenado (RF-008)
- `{ targetId: 1, createdAt: -1 }` — suporta `GET /v1/me/follow-requests?direction=incoming` (D6)
- `{ requesterId: 1, createdAt: -1 }` — suporta `GET /v1/me/follow-requests?direction=outgoing`

**Regras**:
- `create(requesterId, targetId, now)`: `insertOne`; violação do índice único (`requesterId`+`targetId`) → o repository busca e devolve o pedido já existente em vez de propagar o erro cru (RF-008, idempotente na criação — mesmo padrão de "reaproveitar" do `startReading` na 003, D5 de lá).
- `requesterId === targetId` nunca chega ao repository — barrado no service antes (RF-006).
- `deleteByPair(requesterId, targetId)`: usado tanto para cancelar (RF-009) quanto, internamente, para apagar o pedido ao aprovar/recusar (RF-010/RF-012). `null` se não achou → o service traduz para `FollowRequestNotFoundError` (D7).
- `findByPair(requesterId, targetId)`: usado por aprovar/recusar para confirmar que o pedido pendente existe e pertence ao par esperado antes de agir (D7).

---

## Follow

Relação de follow **direcional e aprovada** (glossário de `product.md`, P1/P13). Coleção
`follows`. Criada só pela aprovação de um `FollowRequest` (RF-010); nunca cria a relação
inversa automaticamente (RF-011).

| Campo | Tipo | Obrigatório | Regra / origem |
|---|---|---|---|
| `_id` | `ObjectId` | sim | exposto como `id: string` |
| `followerId` | `ObjectId` | sim | quem segue (referência a `users._id`) |
| `followeeId` | `ObjectId` | sim | quem é seguido |
| `createdAt` | `Date` | sim | instante da aprovação; chave de ordenação/cursor das listas de seguidores/seguindo |

**Índices** (migration `create-follows-collection`):
- `{ followerId: 1, followeeId: 1 }` único composto — no máximo uma relação por par ordenado (RF-007, base da checagem "já segue")
- `{ followeeId: 1, createdAt: -1 }` — suporta `GET /v1/me/followers` (RF-018)
- `{ followerId: 1, createdAt: -1 }` — suporta `GET /v1/me/following` (RF-019)

**Regras**:
- `create(followerId, followeeId, now)`: chamado só pelo fluxo de aprovação (dentro da mesma operação de serviço que apaga o `FollowRequest` correspondente — RF-010).
- `exists(followerId, followeeId)`: usado por `sendFollowRequest` para rejeitar com `AlreadyFollowingError` antes de criar um novo pedido (RF-007).
- `deleteByPair(followerId, followeeId)`: usado tanto por "deixar de seguir" (RF-014, par `(eu, :userId)`) quanto por "remover seguidor" (RF-015, par `(:userId, eu)`). `null` se não achou → `FollowNotFoundError` (RF-017, D7).
- `listByFollowee(followeeId, cursor, limit)`: seguidores de alguém — só usado com `followeeId = eu` (RF-018, RF-020 impede consultar de terceiros na camada de service, não de repository).
- `listByFollower(followerId, cursor, limit)`: quem alguém segue — só usado com `followerId = eu` (RF-019, RF-020 mesma nota).

---

## Erros de domínio novos (estendem `AppError`, P5 da constituição)

| Erro | HTTP | Quando |
|---|---|---|
| `CannotFollowSelfError` | 422 | pedido de follow para o próprio `userId` (RF-006) |
| `AlreadyFollowingError` | 409 | pedido de follow para alguém que já se segue (aprovado) (RF-007) |
| `FollowRequestNotFoundError` | 404 | aprovar/recusar/cancelar um pedido que não existe para o par esperado (RF-016, D7) |
| `FollowNotFoundError` | 404 | deixar de seguir/remover seguidor de um par sem relação aprovada (RF-017, D7) |

## DTOs (camada de service → controller)

```ts
export interface ProfileDTO { id: string; handle: string; displayName: string; bio: string | null }

export interface UserSearchResultDTO { id: string; handle: string; displayName: string; avatarUrl: string | null }
export interface UserSearchPageDTO { items: UserSearchResultDTO[]; page: number; limit: number; totalItems: number }

export interface FollowRequestDTO { userId: string; handle: string; displayName: string; direction: 'incoming' | 'outgoing'; createdAt: string }
export interface FollowRequestCursorPageDTO { items: FollowRequestDTO[]; nextCursor: string | null }

// Retorno de sendFollowRequest (POST .../follow-request) — forma diferente de FollowRequestDTO
// (que é só pra listagem, com handle/displayName/direction do outro lado). Bate com o schema
// FollowRequestResource do contracts/profile-follow.openapi.yaml (achado do /analyze — as duas
// formas divergiam).
export interface FollowRequestCreationDTO { requesterId: string; targetId: string; createdAt: string }

export interface FollowedUserDTO { userId: string; handle: string; displayName: string; createdAt: string }
export interface FollowCursorPageDTO { items: FollowedUserDTO[]; nextCursor: string | null }
```
