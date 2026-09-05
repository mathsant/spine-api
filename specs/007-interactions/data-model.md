# Fase 1 — Modelo de Dados: Interações (comentar e curtir)

Feature: `007-interactions` · Data: 2026-09-04

Todos os identificadores em inglês (regra fixa do kit). Persistência via MongoDB; toda criação de
coleção/índice vem de uma migration `migrate-mongo` (P4). Nenhum acesso ao driver fora de
`src/repositories/**` e `src/db/**` (P2).

---

## Comment

Comentário de texto sobre um item de feed (`Activity`, 006). Coleção `comments`.

| Campo | Tipo | Obrigatório | Regra / origem |
|---|---|---|---|
| `_id` | `ObjectId` | sim | gerado pelo Mongo; exposto às camadas como `id: string` (hex) |
| `activityId` | `string` | sim | referência a `activities._id` — o alvo do comentário (RF-005) |
| `readingSessionId` | `string` | sim | denormalizado da `Activity` de origem, só para cascade de deleção (D3 do `research.md`) |
| `activityType` | `'started_reading' \| 'finished_reading' \| 'review_published' \| 'progress_update'` | sim | denormalizado da `Activity` de origem, só para cascade de deleção (D3) |
| `authorId` | `string` | sim | quem escreveu (referência a `users._id`) |
| `text` | `string` | sim | conteúdo do comentário; nunca vazio na criação (RF-006). Depois de um soft delete, a leitura devolve `"[removido]"` no lugar do valor persistido — o texto original permanece no banco, só não é mais servido (moderação, P do `product.md`) |
| `parentCommentId` | `string \| null` | não | referência a outro `comments._id` do **mesmo** `activityId`; `null` = comentário de nível 1 (top-level). Só pode apontar para um comentário cujo próprio `parentCommentId` seja `null` (RF-010 — aninhamento máximo de 1 nível) |
| `deletedAt` | `Date \| null` | não | `null` até o autor apagar (RF-009); presença desse campo é o que decide o placeholder na leitura |
| `createdAt` | `Date` | sim | instante de criação; chave de ordenação/cursor (ordem ascendente, D5 do `research.md`) |

**Índices** (migration `create-comments-collection`):
- `{ activityId: 1, createdAt: 1, _id: 1 }` — página por cursor ascendente de um item (RF-008, D5)
- `{ readingSessionId: 1, activityType: 1 }` — cascade de deleção (D3); o prefixo `readingSessionId`
  sozinho já serve `deleteByReadingSessionId`, e o índice completo serve
  `deleteByReadingSessionIdAndType`

**Regras**:
- `create(input)`: insere um documento; `input` traz `activityId`, `readingSessionId`,
  `activityType`, `authorId`, `text`, `parentCommentId` (opcional). Nunca falha por duplicidade —
  não há índice único (múltiplos comentários por item são esperados).
- `findById(commentId)`: usado para (a) resolver o comentário-pai numa resposta (RF-007/RF-010) e
  (b) checar posse antes de um soft delete (RF-009). Retorna o documento mesmo se `deletedAt` não
  for `null` (um comentário apagado ainda pode ser pai de uma resposta — caso de borda da spec).
- `listByActivity(activityId, cursor, limit)`: página por cursor ascendente (`createdAt`/`_id`),
  filtrada por `activityId` (RF-008).
- `softDelete(commentId, deletedAt)`: `$set` de `deletedAt`; não remove o documento nem o `text`
  persistido (só a camada de DTO troca a exibição — ver `to-dto.ts` abaixo).
- `deleteByReadingSessionId(readingSessionId)`: remove **todos** os comentários daquela session,
  qualquer `activityType` — cascade de `delete-reading-session.service.ts` (RF-013).
- `deleteByReadingSessionIdAndType(readingSessionId, activityType)`: remove só os comentários do
  tipo indicado naquela session — cascade de `delete-review.service.ts` com
  `activityType = 'review_published'` (RF-013).

---

## Reaction

Curtida simples (um único tipo, sem variação) de um usuário sobre um item de feed. Coleção
`reactions`.

| Campo | Tipo | Obrigatório | Regra / origem |
|---|---|---|---|
| `_id` | `ObjectId` | sim | gerado pelo Mongo; exposto às camadas como `id: string` (hex) |
| `activityId` | `string` | sim | referência a `activities._id` — o alvo da curtida (RF-001) |
| `readingSessionId` | `string` | sim | denormalizado da `Activity` de origem, só para cascade (D3) |
| `activityType` | `'started_reading' \| 'finished_reading' \| 'review_published' \| 'progress_update'` | sim | denormalizado da `Activity` de origem, só para cascade (D3) |
| `userId` | `string` | sim | quem curtiu (referência a `users._id`) |
| `createdAt` | `Date` | sim | instante da curtida |

**Índices** (migration `create-reactions-collection`):
- **único** `{ activityId: 1, userId: 1 }` — no máximo uma curtida por (usuário, item); é o que
  torna `add` idempotente via `upsert` (RF-002, D4 do `research.md`). Serve também
  `listReactedActivityIds` (prefixo `activityId`+filtro `userId`) e a contagem por item (prefixo
  `activityId`).
- `{ readingSessionId: 1, activityType: 1 }` — cascade de deleção (D3), mesmo raciocínio de
  `Comment`.

**Regras**:
- `add(activityId, userId, readingSessionId, activityType, now)`: `updateOne` com
  `$setOnInsert` + `upsert: true` sobre a chave `{ activityId, userId }` — repetir não duplica nem
  falha (RF-002).
- `remove(activityId, userId)`: `deleteOne`; retorna se algo foi de fato removido (para
  `ReactionNotFoundError` quando não havia curtida a remover, RF-003).
- `countByActivityIds(activityIds)`: agregação `$match` + `$group` por `activityId`, contagem —
  usado pelo feed (D7) e por qualquer leitura futura de um item avulso.
- `listReactedActivityIds(userId, activityIds)`: `find({ userId, activityId: { $in } })`,
  projeção só de `activityId` — usado pelo feed para `hasReacted` em lote (D7).
- `deleteByReadingSessionId(readingSessionId)` / `deleteByReadingSessionIdAndType(readingSessionId, activityType)`:
  mesmo papel de cascade de `Comment`, para `Reaction` (RF-013).

---

## Extensões de entidades/repositories existentes

### `ActivityRepository` (006) — 1 método novo

`findById(activityId: string): Promise<ActivityRecord | null>` — resolve o alvo de um
comentário/curtida antes de qualquer escrita ou listagem (D1 do `research.md`). Sem esse método,
não há como validar existência/tipo/dono de um `activityId` recebido fora do fluxo de leitura do
feed.

### `delete-reading-session.service.ts` (003, alterado)

`DeleteReadingSessionDeps` ganha `commentRepository: CommentRepository` e
`reactionRepository: ReactionRepository`. Depois de `activityRepository.deleteBySessionId(sessionId)`
(já existente, 006), chama `commentRepository.deleteByReadingSessionId(sessionId)` e
`reactionRepository.deleteByReadingSessionId(sessionId)` (RF-013).

### `delete-review.service.ts` (005, alterado)

`DeleteReviewDeps` ganha `commentRepository: CommentRepository` e
`reactionRepository: ReactionRepository`. Depois de
`activityRepository.deleteBySessionIdAndType(existing.sessionId, 'review_published')` (já
existente, 006), chama `commentRepository.deleteByReadingSessionIdAndType(existing.sessionId, 'review_published')`
e `reactionRepository.deleteByReadingSessionIdAndType(existing.sessionId, 'review_published')`
(RF-013).

### `get-feed.service.ts` (006, alterado)

`GetFeedDeps` ganha `reactionRepository: ReactionRepository`. Para o conjunto de `activityId`s
únicos da página, `Promise.all` de `reactionRepository.countByActivityIds(activityIds)` e
`reactionRepository.listReactedActivityIds(userId, activityIds)` (D7). `FeedItemDTO` ganha
`reactionsCount: number` e `hasReacted: boolean`.

---

## Serviço novo compartilhado — `resolveVisibleActivity`

`src/services/activities/resolve-visible-activity.ts` (sem rota HTTP própria — só reuso interno,
D1 do `research.md`).

```ts
export interface ResolveVisibleActivityDeps {
  activityRepository: ActivityRepository;
  followRepository: FollowRepository;
}

export type ResolveVisibleActivity = (
  activityId: string,
  viewerId: string,
) => Promise<ActivityRecord>;
```

Fluxo:
1. `activity = activityRepository.findById(activityId)`; se `null` → `ActivityNotFoundError` (404).
2. Se `activity.actorId !== viewerId` e `!followRepository.exists(viewerId, activity.actorId)` →
   `ActivityNotFoundError` (404) — mesma semântica de privacidade do resto da API (RF-012/RF-015).
3. Se `activity.type === 'started_reading'` → `UnsupportedActivityInteractionError` (422, RF-011).
4. Retorna `activity`.

Consumido por `create-comment`, `list-comments`, `create-reaction`, `delete-reaction`.
`delete-comment` não usa (D6).

---

## DTOs de resposta (camada HTTP)

```ts
export interface CommentDTO {
  id: string;
  activityId: string;
  authorId: string;
  text: string;                    // "[removido]" quando deletedAt !== null (nunca o texto original)
  parentCommentId: string | null;
  deleted: boolean;                 // deletedAt !== null
  createdAt: string;
}

export interface CommentCursorPageDTO {
  items: CommentDTO[];
  nextCursor: string | null;
}

export interface ReactionSummaryDTO {
  reactionsCount: number;
  hasReacted: boolean;
}
```

`FeedItemDTO` (006, alterado) ganha os dois campos de `ReactionSummaryDTO` no nível raiz (não
aninhado — D8 do `research.md`):

```ts
export interface FeedItemDTO {
  // ...campos existentes da 006, inalterados...
  reactionsCount: number;
  hasReacted: boolean;
}
```

---

## Erros novos

| Classe | `code` | HTTP | Quando |
|---|---|---|---|
| `ActivityNotFoundError` | `ACTIVITY_NOT_FOUND` | 404 | `activityId` não existe, ou existe mas o viewer não é o dono nem segue aprovado (RF-012, RF-015) |
| `UnsupportedActivityInteractionError` | `UNSUPPORTED_ACTIVITY_INTERACTION` | 422 | alvo é do tipo `started_reading` (RF-011) |
| `CommentNotFoundError` | `COMMENT_NOT_FOUND` | 404 | `commentId` não existe; ou existe mas não pertence ao usuário (delete, RF-009); ou `parentCommentId` não existe ou não pertence ao mesmo `activityId` (RF-007) |
| `CommentNestingTooDeepError` | `COMMENT_NESTING_TOO_DEEP` | 422 | `parentCommentId` aponta para um comentário que já é, ele mesmo, uma resposta (RF-010) |
| `ReactionNotFoundError` | `REACTION_NOT_FOUND` | 404 | tentativa de descurtir um item que o usuário não havia curtido (RF-003) |

Todos estendem `AppError` (princípio "Erros tipados com hierarquia a partir de um tipo base").
