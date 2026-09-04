# Tarefas: Reviews

**Entrada**: `plan.md`, `data-model.md`, `contracts/`, `quickstart.md` de `specs/005-reviews/`
**Convenção**: `[P]` = pode rodar em paralelo (arquivos diferentes, sem dependência entre si). Sem `[P]` = sequencial (mesmo arquivo ou depende de outra tarefa).

Caminhos seguem a tabela "Onde cada tipo de código novo deve ir" de `.specify/memory/architecture.md`.
Cada tarefa que cria arquivos numa pasta de domínio nova também cria/atualiza o `index.ts` de
re-export dessa pasta (exports nomeados, nunca `export default`).

**Nota sobre índices nos testes de integração**: a migration (T001) **não** roda sob
`mongodb-memory-server`. As asserções que dependem do índice único `sessionId` (a tradução de
`code 11000` em `ReviewAlreadyExistsError` — RF-003) usam o helper `ensureReviewIndexes` (T002)
no `beforeAll`.

**Nota sobre reuso**: `ReadingSessionNotFoundError` e a interface `ReadingSessionRepository`
já existem da 003-bookcatalogflow — esta feature só os consome, não recria.

## Fases (cada uma é um marco entregável)

1. **Fundação** — a migration da coleção `reviews` (2 índices) e o helper de índice para teste. Marco: `pnpm migrate:up` cria `reviews` com o índice único de `sessionId` e o índice de `bookId`.
2. **Erros tipados e schemas de entrada** — 3 classes de erro novas + os 2 schemas `zod` dos endpoints com corpo. Marco: `pnpm lint`/`pnpm build` limpos; `ZodError` já vira `400 VALIDATION_ERROR`.
3. **Camada de dados** — `ReviewRepository` (interface + impl Mongo), em ordem TDD. Marco: integração verde com `mongodb-memory-server`, incl. a tradução do índice único em `ReviewAlreadyExistsError` e a agregação `getAggregatesByBook`.
4. **Regras de negócio `reviews` + fiação parcial do container** — os 3 services de `src/services/reviews/` em ordem TDD, e o registro de `reviewRepository` + os 3 services no Awilix. Marco: cobertura de `src/services/reviews/**` ≥ 70%.
5. **Extensões de `books`/`reading-sessions` + fiação final do container** — agregados reais no detalhe do livro, cascade delete e review embutida no histórico de reading sessions. Marco: os cenários 7, 9, 10 e 13 da spec passam nos services estendidos.
6. **Borda HTTP** — os 3 controllers, o plugin de rota `reviews` e `app.ts`. Marco: `app.inject()` cobre os 14 cenários de aceitação da spec.
7. **Documentação e fechamento** — README, checagens estruturais e execução do `quickstart.md`. Marco: Definição de Pronto toda verificável.

---

## Fase 1: Fundação

- [x] T001 Gerar via `pnpm migrate:create -- create-reviews-collection` e preencher: `up` cria a coleção `reviews`, `createIndex({ sessionId: 1 }, { unique: true })` (relação 1:1 com `ReadingSession`, RF-003) e `createIndex({ bookId: 1 })` (agregação do detalhe do livro, RF-009); `down` faz `db.collection('reviews').drop()`. Arquivo: `migrations/<timestamp>-create-reviews-collection.js`
- [x] T002 Criar `ensureReviewIndexes(db: Db): Promise<void>` replicando os 2 índices de T001, mesmo padrão de `ensureBookIndexes`/`ensureFollowIndexes`. Arquivo: `tests/helpers/review-indexes.ts` (depende de T001)

## Fase 2: Erros tipados e schemas de entrada

- [x] T003 [P] Criar `ReviewNotFoundError extends AppError` (`code: 'REVIEW_NOT_FOUND'`, `statusCode: 404`; usada tanto para `reviewId` inexistente quanto de outro usuário — D7/D9). Arquivo: `src/errors/review-not-found-error.ts`
- [x] T004 [P] Criar `ReviewAlreadyExistsError extends AppError` (`code: 'REVIEW_ALREADY_EXISTS'`, `statusCode: 409`). Arquivo: `src/errors/review-already-exists-error.ts`
- [x] T005 [P] Criar `ReadingSessionNotFinishedError extends AppError` (`code: 'READING_SESSION_NOT_FINISHED'`, `statusCode: 409`; distinta de `InvalidReadingSessionStateError` da 003 — D3 do `research.md`). Arquivo: `src/errors/reading-session-not-finished-error.ts`
- [x] T006 Atualizar o barrel de erros reexportando as 3 classes novas junto das existentes. Arquivo: `src/errors/index.ts` (depende de T003–T005)
- [x] T007 [P] Schema `zod` de `createReview` (body) + teste unitário (TDD): `rating` obrigatório (int `1..5`, RF-001, RF-011); `text` opcional (string, `max 2000`, RF-004); `containsSpoiler` opcional (boolean, default `false`). Arquivos: `src/schemas/reviews/create-review.schema.ts`, `tests/unit/schemas/reviews/create-review.schema.spec.ts`
- [x] T008 [P] Schema `zod` de `editReview` (body) + teste unitário (TDD): `rating` opcional (int `1..5`), `text` opcional (`string | null`, `max 2000`), `containsSpoiler` opcional (boolean); `.refine` exigindo ao menos 1 campo presente (RF-005). Arquivos: `src/schemas/reviews/edit-review.schema.ts`, `tests/unit/schemas/reviews/edit-review.schema.spec.ts`
- [x] T009 Criar o barrel `src/schemas/reviews/index.ts` reexportando os 2 schemas e seus tipos inferidos. Arquivo: `src/schemas/reviews/index.ts` (depende de T007, T008)

## Fase 3: Camada de dados (TDD)

- [x] T010 Teste de integração de `MongoReviewRepository` (TDD, `mongodb-memory-server` + `ensureReviewIndexes` no `beforeAll`): `create` insere; uma 2ª `create` para o mesmo `sessionId` → `ReviewAlreadyExistsError` (índice único, D2 do `research.md`, RF-003); `findById`/`findBySessionId` acham e devolvem `null` quando não há; `findBySessionIds` devolve várias por `$in`; `edit` faz `$set` só das chaves do patch; `delete` remove; `deleteBySessionId` é idempotente (sem erro se a session não tiver review); `getAggregatesByBook` sem reviews → `{ averageRating: null, reviewCount: 0 }`; com N reviews → `averageRating` arredondado a 1 casa decimal e `reviewCount` real. Arquivo: `tests/integration/repositories/reviews/mongo-review.repository.spec.ts` (depende de T002, T004)
- [x] T011 Criar a interface `ReviewRepository` e os tipos `ReviewRecord`, `CreateReviewInput`, `EditReviewInput`, `ReviewAggregates` conforme `contracts/internal-ports.md`. Arquivo: `src/repositories/reviews/review.repository.ts`
- [x] T012 Criar `MongoReviewRepository implements ReviewRepository` recebendo `db: Db`: mapeia `_id` ↔ `id` (hex); `create` captura `code 11000` do índice único de `sessionId` e lança `ReviewAlreadyExistsError` em vez de propagar (nunca absorve/sobrescreve — D2); `getAggregatesByBook` usa `{ $match: { bookId } } → { $group: { _id: null, averageRating: { $avg: '$rating' }, reviewCount: { $sum: 1 } } }`, arredondando `averageRating` a 1 casa decimal (D4). Arquivo: `src/repositories/reviews/mongo-review.repository.ts` (depende de T011, T004; faz T010 passar)
- [x] T013 Criar o barrel `src/repositories/reviews/index.ts` reexportando a interface, os tipos e `MongoReviewRepository`. Arquivo: `src/repositories/reviews/index.ts` (depende de T011, T012)

## Fase 4: Regras de negócio `reviews` + fiação parcial do container

- [x] T014 Criar o DTO de resposta do domínio `reviews` (`ReviewDTO`) conforme `data-model.md`. Arquivo: `src/services/reviews/types.ts`
- [x] T015 Criar `toReviewDTO(record: ReviewRecord): ReviewDTO`. Arquivo: `src/services/reviews/to-dto.ts` (depende de T011, T014)
- [x] T016 [P] Teste de integração de `create-review.service` (TDD): session `finished` do dono sem review → cria e devolve o `ReviewDTO`; session `reading` do dono → `ReadingSessionNotFinishedError` (RF-002); session `finished` do dono que já tem review → `ReviewAlreadyExistsError` (RF-003); session inexistente ou de outro usuário → `ReadingSessionNotFoundError` (RF-008, D7/D9). Arquivo: `tests/integration/services/reviews/create-review.service.spec.ts` (depende de T012, T005, T004)
- [x] T017 Criar `makeCreateReview({ reviewRepository, readingSessionRepository }): CreateReview` conforme `contracts/internal-ports.md`: busca a session por `sessionId`, valida posse e `status === 'finished'`, checa `findBySessionId` antes de criar. Arquivo: `src/services/reviews/create-review.service.ts` (depende de T011, T014, T015; faz T016 passar)
- [x] T018 [P] Teste de integração de `edit-review.service` (TDD): edição parcial de uma review do dono → atualiza só os campos enviados, mantendo os demais (RF-005, cenários 6–7 do `spec.md`); review inexistente ou de outro usuário → `ReviewNotFoundError` (RF-008). Arquivo: `tests/integration/services/reviews/edit-review.service.spec.ts` (depende de T012, T003)
- [x] T019 Criar `makeEditReview({ reviewRepository }): EditReview` — checa posse por `reviewId` antes de delegar. Arquivo: `src/services/reviews/edit-review.service.ts` (depende de T011, T014, T015; faz T018 passar)
- [x] T020 [P] Teste de integração de `delete-review.service` (TDD): apaga a review do dono; review inexistente ou de outro usuário → `ReviewNotFoundError`, sem apagar (RF-008). Arquivo: `tests/integration/services/reviews/delete-review.service.spec.ts` (depende de T012, T003)
- [x] T021 Criar `makeDeleteReview({ reviewRepository }): DeleteReview` — checa posse antes de delegar. Arquivo: `src/services/reviews/delete-review.service.ts` (depende de T011; faz T020 passar)
- [x] T022 Criar o barrel `src/services/reviews/index.ts` reexportando os 3 `makeXxx`, os tipos de função, `toReviewDTO` e `ReviewDTO`. Arquivo: `src/services/reviews/index.ts` (depende de T017, T019, T021)
- [x] T023 Registrar `reviewRepository` (`asFunction((cradle) => new MongoReviewRepository(cradle.db))`, singleton) no registro de repositories. Arquivo: `src/container/register-repositories.ts` (depende de T012)
- [x] T024 Estender `AppCradle` com `reviewRepository` e os 3 tipos de service (`CreateReview`, `EditReview`, `DeleteReview`). Arquivo: `src/container/cradle.ts` (depende de T011, T017, T019, T021)
- [x] T025 Registrar `createReviewService`, `editReviewService`, `deleteReviewService` no registro de services. Arquivo: `src/container/register-services.ts` (depende de T022, T023)

## Fase 5: Extensões de `books`/`reading-sessions` + fiação final do container

- [x] T026 [P] Teste de integração de `get-book.service` — caso novo (TDD): um livro com N reviews reais → `aggregates.averageRating`/`aggregates.reviewCount` refletem as reviews existentes (RF-009, cenário 9 do `spec.md`); livro sem review → continuam `null`/`0` (cenário 10). Arquivo: `tests/integration/services/books/get-book.service.spec.ts` (depende de T012)
- [x] T027 Atualizar `makeGetBook`: `GetBookDeps` ganha `reviewRepository`; `toDTO` usa `reviewRepository.getAggregatesByBook(book.id)` em vez de `null`/`0` fixos. Arquivo: `src/services/books/get-book.service.ts` (depende de T011; faz T026 passar)
- [x] T028 [P] Teste de integração de `delete-reading-session.service` — caso novo (TDD): apagar uma session que tem review → a review some junto (cascade, RF-007, cenário 8 do `spec.md`); apagar uma session sem review → sem erro. Arquivo: `tests/integration/services/reading-sessions/delete-reading-session.service.spec.ts` (depende de T012)
- [x] T029 Atualizar `makeDeleteReadingSession`: `DeleteReadingSessionDeps` ganha `reviewRepository`; chama `reviewRepository.deleteBySessionId(sessionId)` ao apagar a session. Arquivo: `src/services/reading-sessions/delete-reading-session.service.ts` (depende de T011; faz T028 passar)
- [x] T030 [P] Teste de integração de `list-reading-sessions.service` — caso novo (TDD): item de uma session com review → `ReadingSessionDTO.review` preenchido; item sem review → `review: null` (RF-010, cenário 13 do `spec.md`). Arquivo: `tests/integration/services/reading-sessions/list-reading-sessions.service.spec.ts` (depende de T012)
- [x] T031 Atualizar `toReadingSessionDTO(record, review = null)` (segundo parâmetro opcional) e `ReadingSessionDTO` (campo `review: ReviewDTO | null`) conforme `data-model.md` — call sites existentes (`start-reading`, `mark-finished`, `update-progress`, `finish-reading-session`, `edit-reading-session`) continuam chamando com 1 argumento e recebem `review: null` automaticamente, sem alteração neles. Arquivos: `src/services/reading-sessions/to-dto.ts`, `src/services/reading-sessions/types.ts` (depende de T014, T015)
- [x] T032 Atualizar `makeListReadingSessions`: `ListReadingSessionsDeps` ganha `reviewRepository`; busca `reviewRepository.findBySessionIds(page.items.map(s => s.id))` numa única consulta (D5, sem N+1), monta um `Map<sessionId, ReviewRecord>` e passa a review correspondente pra `toReadingSessionDTO`. Arquivo: `src/services/reading-sessions/list-reading-sessions.service.ts` (depende de T011, T031; faz T030 passar)
- [x] T033 Atualizar o registro de services: acrescentar `reviewRepository: cradle.reviewRepository` nas factories de `getBookService`, `deleteReadingSessionService` e `listReadingSessionsService`. Arquivo: `src/container/register-services.ts` (depende de T025 — mesmo arquivo; T027, T029, T032)

## Fase 6: Borda HTTP

- [x] T034 [P] Criar `create-review.controller.ts`: valida o corpo com `createReviewSchema`, usa `request.currentUser.id` + param `sessionId`, resolve `createReviewService`, responde `201`. Arquivo: `src/controllers/reviews/create-review.controller.ts` (depende de T007, T017)
- [x] T035 [P] Criar `edit-review.controller.ts`: valida o corpo com `editReviewSchema`, usa `request.currentUser.id` + param `reviewId`, resolve `editReviewService`, responde `200`. Arquivo: `src/controllers/reviews/edit-review.controller.ts` (depende de T008, T019)
- [x] T036 [P] Criar `delete-review.controller.ts`: usa `request.currentUser.id` + param `reviewId`, resolve `deleteReviewService`, responde `204`. Arquivo: `src/controllers/reviews/delete-review.controller.ts` (depende de T021)
- [x] T037 Criar o barrel `src/controllers/reviews/index.ts` reexportando `reviewsRoutes` e os 3 controllers. Arquivo: `src/controllers/reviews/index.ts` (depende de T034–T036, T038)
- [x] T038 Criar o plugin de rotas do domínio `reviews`: `POST /reading-sessions/:sessionId/review`, `PATCH /reviews/:reviewId`, `DELETE /reviews/:reviewId` — todas com `preHandler: app.authenticate`. Arquivo: `src/controllers/reviews/reviews.routes.ts` (depende de T034–T036)
- [x] T039 Teste de integração de rotas via `buildApp` + `app.inject()` (TDD — escrito antes de T040, que faz a fiação e o torna verde) cobrindo os 14 cenários de aceitação + casos de borda do `spec.md`: criar (`201`/`409 READING_SESSION_NOT_FINISHED`/`409 REVIEW_ALREADY_EXISTS`/`404`/`400`); editar parcial (`200`/`400` sem campos/`404`); apagar (`204`/`404` depois); `GET /books/:olid` com `aggregates` reais; `GET /me/reading-sessions` com `review` embutida; apagar a reading session apaga a review em cascata. Arquivo: `tests/integration/http/reviews.routes.spec.ts` (depende de T038)
- [x] T040 Atualizar `buildApp`: registrar `reviewsRoutes` com `{ prefix: '/v1' }`. Arquivo: `src/app.ts` (depende de T037; faz T039 passar)

## Fase 7: Documentação e fechamento

- [x] T041 [P] Acrescentar ao `README.md` a seção **Reviews**: os 3 endpoints novos com corpo e respostas de sucesso/erro, a extensão dos 2 endpoints existentes (`GET /books/:olid`, `GET /me/reading-sessions`), a tabela de códigos de erro novos (de `contracts/error-codes.md`) e o passo `pnpm migrate:up`. Arquivo: `README.md`
- [x] T042 Rodar `pnpm lint`, `pnpm test` (unit + integration), `pnpm test:coverage` e `pnpm build`; conferir `grep -rn "export default" src` vazio, `grep -rn "from 'mongodb'" src/services src/controllers` vazio, e o `index.ts` de `src/{controllers,services,repositories,schemas}/reviews/`; sanar o que falhar. Sem arquivo fixo (ajustes pontuais onde o comando apontar). (depende de T001–T040)
- [x] T043 Executar `specs/005-reviews/quickstart.md` de ponta a ponta (`pnpm migrate:up` + servidor local) e marcar cada item da "Definição de Pronto" no `spec.md`. Arquivo: `specs/005-reviews/spec.md` (depende de T042)

---

## Dependências

- **Fase 1 → todas**: a migration (T001) define os índices que o helper de teste (T002) replica e que o `quickstart` aplica de verdade.
- **Fase 2 → Fases 3–6**: as 3 classes de erro (T003–T005) são usadas pelo repository e pelos services; os 2 schemas (T007, T008) são usados pelos controllers.
- **Fase 3 → Fases 4–5**: `ReviewRepository`/`MongoReviewRepository` é injetado nos 3 services novos de `reviews` e nas 3 extensões de `books`/`reading-sessions`; `ensureReviewIndexes` (T002) é pré-requisito do teste de integração do repositório.
- **Fase 4 → Fase 5**: os services de `reviews` (em especial `ReviewDTO`/`toReviewDTO` de T014/T015) são reaproveitados pela extensão de `ReadingSessionDTO` (T031); o container precisa ter `reviewRepository` registrado (T023) antes das extensões usarem-no via `cradle.reviewRepository`.
- **Fase 5 → Fase 6**: as extensões de `get-book`/`delete-reading-session`/`list-reading-sessions` precisam estar de pé antes do teste HTTP (T039) cobrir os cenários de agregados reais e review embutida.
- **Fase 6 → Fase 7**: `app.ts` completo (T040) é pré-requisito do `quickstart` e das checagens finais.
- Internas relevantes:
  - T001 → T002 → T010
  - T003–T005 → T006
  - T007, T008 → T009
  - T002, T004 → T010 (teste) → T011 → T012 (faz T010 passar) → T013
  - T011, T014 → T015
  - T012, T005, T004 → T016 (teste) → T017 (faz T016 passar)
  - T012, T003 → T018 (teste) → T019 (faz T018 passar)
  - T012, T003 → T020 (teste) → T021 (faz T020 passar)
  - T017, T019, T021 → T022
  - T012 → T023; T011, T017, T019, T021 → T024; T022, T023 → T025
  - T012 → T026 (teste) → T027 (faz T026 passar)
  - T012 → T028 (teste) → T029 (faz T028 passar)
  - T012 → T030 (teste); T014, T015 → T031; T011, T031 → T032 (faz T030 passar)
  - T025 (mesmo arquivo) + T027 + T029 + T032 → T033
  - T007, T017 → T034; T008, T019 → T035; T021 → T036
  - T034–T036 → T037, T038
  - T038 → T039 (escrito para falhar; T040 o faz passar)
  - T037 → T040 → T042; T001–T040 → T042 → T043

## Exemplo de execução em paralelo

```
# Fase 2 — as 3 classes de erro (arquivos distintos, sem dependência entre si):
T003 review-not-found-error.ts | T004 review-already-exists-error.ts
T005 reading-session-not-finished-error.ts

# Fase 2 — os 2 schemas + specs (pares independentes):
T007 create-review | T008 edit-review

# Fase 4 — os testes de integração dos 3 services de reviews (arquivos distintos):
T016 create-review | T018 edit-review | T020 delete-review

# Fase 5 — os testes de integração dos 3 casos novos em services existentes (arquivos distintos):
T026 get-book | T028 delete-reading-session | T030 list-reading-sessions

# Fase 6 — os 3 controllers (arquivos distintos, após seus services):
T034 create-review.controller | T035 edit-review.controller | T036 delete-review.controller

# Fase 7 — T041 (README) corre em paralelo ao restante; T042/T043 são sequenciais e finais.
```

## Notas

- Ordem TDD: T010→T012, T016→T017, T018→T019, T020→T021, T026→T027, T028→T029, T030→T032,
  T039→T040 (o teste é escrito para falhar antes da implementação que o satisfaz — mesmo
  padrão das features 003/004).
- `Review` nunca tem um campo derivado de `ReadingSession` além de `bookId` (denormalizado,
  D1 do `research.md`) — evita `$lookup` na agregação do detalhe do livro.
- Nenhum service de `reviews` importa `mongodb` diretamente — só `MongoReviewRepository`
  (`src/repositories/reviews/**`).
- Posse por `reviewId` (D7/D9): `edit-review`/`delete-review` (T019/T021) resolvem sempre pelo
  dono e usam `ReviewNotFoundError` tanto para "nunca existiu" quanto para "não pertence a
  esse usuário" — nunca `403`. Posse por `sessionId` na criação (T017) usa
  `ReadingSessionNotFoundError` (003, reaproveitado) pelo mesmo motivo.
- `create-review` (T017) é a única operação desta feature que depende de duas interfaces de
  repository (`reviewRepository` + `readingSessionRepository`) — precisa validar posse e
  status da session antes de checar duplicidade de review.
- Índices nos testes: a migration (T001) não roda sob `mongodb-memory-server`; os testes que
  dependem do índice único de `sessionId` chamam `ensureReviewIndexes` (T002). O `quickstart`
  (T043) valida o caminho real com `pnpm migrate:up`.
- Commitar após cada tarefa concluída.
