# Fase 1 — Modelo de Dados: Reviews

Feature: `005-reviews` · Data: 2026-09-04

Todos os identificadores em inglês (regra fixa do kit). Persistência via MongoDB; toda
criação de coleção/índice vem de uma migration `migrate-mongo` (P4). Nenhum acesso ao driver
fora de `src/repositories/**` e `src/db/**` (P2).

---

## Review

Avaliação de um livro feita numa `ReadingSession` finalizada (glossário de `product.md`, P5/P9).
Coleção `reviews`.

| Campo | Tipo | Obrigatório | Regra / origem |
|---|---|---|---|
| `_id` | `ObjectId` | sim | gerado pelo Mongo; exposto às camadas como `id: string` (hex) |
| `userId` | `string` | sim | dono da review — sempre igual ao `userId` da `ReadingSession` de origem |
| `sessionId` | `string` | sim | referência a `reading_sessions._id`; **único** — no máximo 1 review por session (RF-003) |
| `bookId` | `string` | sim | denormalizado de `ReadingSession.bookId` (D1 do `research.md`) — evita `$lookup` na agregação do detalhe do livro |
| `rating` | `number` | sim | inteiro 1–5 (RF-001, RF-011; P5 do produto) |
| `text` | `string \| null` | não | até 2000 caracteres (RF-004); `null` quando não informado ou apagado via edição |
| `containsSpoiler` | `boolean` | sim | padrão `false` na criação (RF-001); nunca oculta o texto da resposta da API — só sinaliza pro cliente (P9 do produto) |
| `createdAt` | `Date` | sim | instante de criação |
| `updatedAt` | `Date` | sim | atualizado em qualquer edição |

**Índices** (migration `create-reviews-collection`):
- `{ sessionId: 1 }` único — impõe a relação 1:1 com `ReadingSession` (RF-003)
- `{ bookId: 1 }` — usado pela agregação de `averageRating`/`reviewCount` no detalhe do livro (RF-009)

**Regras**:
- `create(userId, sessionId, bookId, input)`: insere `{ rating, text: input.text ?? null,
  containsSpoiler: input.containsSpoiler ?? false }`; violação do índice único `sessionId`
  (código `11000`) é traduzida para `ReviewAlreadyExistsError` — nunca sobrescreve nem devolve
  a existente (D2 do `research.md`, cenário 5 do `spec.md`).
- `findBySessionId(sessionId)` / `findBySessionIds(sessionIds[])`: leitura direta pelo índice
  único; a forma em lote (`$in`) alimenta o embutimento em `list-reading-sessions` sem N+1 (D5).
- `edit(reviewId, { rating?, text?, containsSpoiler? })`: `$set` só das chaves presentes no
  patch (RF-005); `text` pode ser setado explicitamente para `null` (string vazia normalizada
  para `null` na camada de service — cenário 7 do `spec.md`); rejeitado (erro de validação na
  borda, antes de chegar aqui) se nenhum campo for enviado.
- `delete(reviewId)`: remove o documento (RF-006).
- `deleteBySessionId(sessionId)`: remove o documento da session, se existir — usado em cascata
  por `delete-reading-session.service.ts` (RF-007); idempotente (não erro se não houver review).
- `getAggregatesByBook(bookId)`: agregação `{ $match: { bookId } } → { $group: { _id: null,
  averageRating: { $avg: '$rating' }, reviewCount: { $sum: 1 } } }`; sem documentos ⇒
  `{ averageRating: null, reviewCount: 0 }` (RF-009); média arredondada para 1 casa decimal
  na camada de service (D4 do `research.md`), não no repository.
- Posse: toda operação por `reviewId` verifica `review.userId === currentUser.id`; não bateu ⇒
  `ReviewNotFoundError` (mesmo tratamento de "não existe", D7/D9 das features 003/004). Toda
  operação por `sessionId` (a criação) verifica a posse da `ReadingSession`, não da `Review`
  (que ainda não existe nesse ponto).

---

## Extensões de entidades existentes

### `ReadingSession` (003) — sem novo campo persistido

Nenhuma coluna nova em `reading_sessions`. A relação com `Review` é só por `sessionId` (lado
"muitos" inexistente — é 1:1). Apagar a `ReadingSession` dispara `deleteBySessionId` no
`ReviewRepository` a partir do service (RF-007) — não é um `$lookup`/cascade nativo do Mongo,
é orquestrado em `delete-reading-session.service.ts`.

### `Book` (003) — agregados deixam de ser sempre nulos/zerados

`averageRating`/`reviewCount` continuam **não persistidos** (mesma escolha da 003, D1 do
`research.md`) — passam a ser calculados de verdade via `ReviewRepository.getAggregatesByBook`,
em vez de retornar sempre `null`/`0`.

---

## DTOs de resposta (camada HTTP)

```ts
export interface ReviewDTO {
  id: string;
  sessionId: string;
  rating: number;
  text: string | null;
  containsSpoiler: boolean;
  createdAt: string;
  updatedAt: string;
}
```

### `ReadingSessionDTO` (003, estendido)

```ts
export interface ReadingSessionDTO {
  id: string;
  bookId: string;
  status: 'reading' | 'finished';
  startedAt: string | null;
  finishedAt: string | null;
  currentPage: number | null;
  createdAt: string;
  review: ReviewDTO | null; // NOVO — RF-010
}
```

`toReadingSessionDTO(record, review = null)` ganha um segundo parâmetro opcional; todo call
site que hoje não lida com review (start/mark-finished/update-progress/finish/edit) continua
compilando sem alteração e devolve `review: null` — só `list-reading-sessions.service.ts`
passa o valor real (D5 do `research.md`).

### `BookDetailDTO` (003, estendido)

```ts
export interface BookDetailDTO extends BookSearchResultDTO {
  id: string;
  aggregates: {
    averageRating: number | null; // ALTERADO — antes sempre null, agora real (RF-009)
    reviewCount: number;          // ALTERADO — antes sempre 0, agora real (RF-009)
    readerCount: number;          // inalterado (003)
  };
}
```

---

## Erros novos

| Classe | `code` | HTTP | Quando |
|---|---|---|---|
| `ReviewAlreadyExistsError` | `REVIEW_ALREADY_EXISTS` | `409` | segunda review na mesma `sessionId` (RF-003) |
| `ReadingSessionNotFinishedError` | `READING_SESSION_NOT_FINISHED` | `409` | criar review numa session que não é `finished` (RF-002) |
| `ReviewNotFoundError` | `REVIEW_NOT_FOUND` | `404` | editar/apagar review inexistente ou de outro usuário (RF-008) |

`ReadingSessionNotFoundError` (003) é reaproveitado sem alteração para "session inexistente ou
de outro usuário" no fluxo de criação (RF-008).
