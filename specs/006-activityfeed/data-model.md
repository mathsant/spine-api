# Fase 1 — Modelo de Dados: Feed de atividade

Feature: `006-activityfeed` · Data: 2026-09-04

Todos os identificadores em inglês (regra fixa do kit). Persistência via MongoDB; toda criação
de coleção/índice vem de uma migration `migrate-mongo` (P4). Nenhum acesso ao driver fora de
`src/repositories/**` e `src/db/**` (P2).

---

## Activity

Evento de atividade, append-only (glossário de `product.md`). Coleção `activities`.

| Campo | Tipo | Obrigatório | Regra / origem |
|---|---|---|---|
| `_id` | `ObjectId` | sim | gerado pelo Mongo; exposto às camadas como `id: string` (hex) |
| `type` | `'started_reading' \| 'finished_reading' \| 'review_published' \| 'progress_update'` | sim | RF-001 a RF-004 |
| `actorId` | `string` | sim | quem gerou o evento (referência a `users._id`) |
| `bookId` | `string` | sim | denormalizado da `ReadingSession` de origem — evita `$lookup` na leitura do feed (mesmo raciocínio de `Review.bookId`, D1 do `research.md` da 005) |
| `readingSessionId` | `string` | sim | referência a `reading_sessions._id`; a origem do evento |
| `currentPage` | `number \| null` | não | **só** para `type === 'progress_update'` (D2 do `research.md`); `null`/ausente nos demais tipos |
| `createdAt` | `Date` | sim | instante do evento (vem de `clock.now()` no service que dispara, não gerado no repository — mesmo padrão de `FollowRecord.createdAt`); chave de ordenação/cursor |

**Índices** (migration `create-activities-collection`):
- `{ actorId: 1, createdAt: -1, _id: -1 }` — suporta `actorId: $in [...]` + ordenação/cursor do feed numa passada só (D7 do `research.md`)
- `{ readingSessionId: 1 }` — usado pelos cascades de deleção (D4 do `research.md`)

**Regras**:
- `record(input, now)`: insere um documento; `input` traz `type`, `actorId`, `bookId`,
  `readingSessionId` e, só para `progress_update`, `currentPage`. Nunca falha por duplicidade —
  não há índice único (múltiplos eventos do mesmo tipo/session são esperados, ex.: vários
  `progress_update`).
- `listForActors(actorIds, cursor, limit)`: página por cursor ordenada `createdAt` desc, filtrada
  por `actorId: { $in: actorIds }` (RF-006, RF-007, RF-008). Mesma mecânica de cursor
  (`$or` de `createdAt`/`_id`) de `reading_sessions.listByUser`/`follows.listByField`.
- `deleteBySessionId(readingSessionId)`: remove **todos** os documentos daquela session,
  qualquer tipo — usado em cascata por `delete-reading-session.service.ts` (D4).
- `deleteBySessionIdAndType(readingSessionId, type)`: remove só os documentos daquele tipo
  naquela session — usado em cascata por `delete-review.service.ts` com `type =
  'review_published'` (D4).

**Nunca populado por**: edição de review (RF-009 — resolvido ao vivo, não gera novo evento nem
atualiza o existente); edição de reading session (`editReadingSession`, RF-017 da 003 — D3 do
`research.md`); marcar/desmarcar `want_to_read` (fora do escopo do glossário de feed).

---

## Extensões de entidades/repositories existentes

### `FollowRepository` (004) — 1 método novo

`listFolloweeIds(followerId: string): Promise<string[]>` — lista completa (não paginada) de quem
o usuário segue, usada só internamente pelo feed para montar o filtro `$in` (D6 do `research.md`).
Implementação: `distinct('followeeId', { followerId })`.

### `ReadingSessionRepository`/`ReviewRepository` (003/005) — sem alteração de porta

Nenhum método novo. O feed usa os já existentes: `reviewRepository.findBySessionIds` (batch,
D5 da 005) para resolver `review_published` ao vivo (RF-009).

### `delete-reading-session.service.ts` (003, alterado)

`DeleteReadingSessionDeps` ganha `activityRepository: ActivityRepository`. Depois de
`readingSessionRepository.delete(sessionId)` e `reviewRepository.deleteBySessionId(sessionId)`,
chama `activityRepository.deleteBySessionId(sessionId)` (D4).

### `delete-review.service.ts` (005, alterado)

`DeleteReviewDeps` ganha `activityRepository: ActivityRepository`. Depois de
`reviewRepository.delete(reviewId)`, chama
`activityRepository.deleteBySessionIdAndType(existing.sessionId, 'review_published')` (D4).

### Services que passam a gravar `Activity` (todos ganham `activityRepository` + `clock` nas deps)

| Service (domínio) | Quando grava | Tipo |
|---|---|---|
| `start-reading.service.ts` (003) | só quando `created === true` (RF-001, D1) | `started_reading` |
| `mark-finished.service.ts` (003) | sempre (RF-002) | `finished_reading` |
| `finish-reading-session.service.ts` (003) | só quando `existing.status !== 'finished'` antes de chamar `repository.finish` (RF-002 + idempotência) | `finished_reading` |
| `update-progress.service.ts` (003) | sempre (RF-004) | `progress_update` (com `currentPage`) |
| `create-review.service.ts` (005) | sempre, após `reviewRepository.create` (RF-003) | `review_published` |

---

## DTOs de resposta (camada HTTP)

```ts
export interface FeedActorDTO {
  userId: string;
  handle: string;
  displayName: string;
}

export interface FeedBookDTO {
  id: string;
  title: string;
  authors: string[];
  coverUrl: string | null;
}

export interface FeedItemDTO {
  id: string;
  type: 'started_reading' | 'finished_reading' | 'review_published' | 'progress_update';
  createdAt: string;
  actor: FeedActorDTO;
  book: FeedBookDTO;
  readingSessionId: string;
  currentPage: number | null;     // preenchido só quando type === 'progress_update'
  review: ReviewDTO | null;       // preenchido (ao vivo) só quando type === 'review_published'
}

export interface FeedCursorPageDTO {
  items: FeedItemDTO[];
  nextCursor: string | null;
}
```

`review` reaproveita `ReviewDTO` (005) sem alteração. Um item cujo `readingSessionId` já não
existe mais nunca aparece na consulta (D4 — cascade na escrita, não filtro na leitura).
