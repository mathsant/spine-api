# Tarefas: Feed de atividade

**Entrada**: `plan.md`, `data-model.md`, `contracts/`, `quickstart.md` de `specs/006-activityfeed/`
**Convenção**: `[P]` = pode rodar em paralelo (arquivos diferentes, sem dependência entre si). Sem `[P]` = sequencial (mesmo arquivo ou depende de outra tarefa).

Caminhos seguem a tabela "Onde cada tipo de código novo deve ir" de `.specify/memory/architecture.md`.
Cada tarefa que cria arquivos numa pasta de domínio nova também cria/atualiza o `index.ts` de
re-export dessa pasta (exports nomeados, nunca `export default`).

**Nota sobre índices nos testes de integração**: diferente de `reviews`/`follows`, `activities`
**não tem índice único** (múltiplos eventos por session são esperados — D2/D7 do `research.md`).
O índice composto `{ actorId, createdAt, _id }` é só otimização de consulta, não muda o
resultado funcional de nenhum teste sob `mongodb-memory-server` — por isso não há um
`ensure*Indexes` helper novo nesta feature (a migration T001 é validada de verdade só no
`quickstart.md`, T039).

**Nota sobre reuso**: `ReadingSessionRepository`, `ReviewRepository`, `FollowRepository` (exceto
o método novo `listFolloweeIds`) e `Clock` já existem das features 003/004/005 — esta feature só
os consome (ou estende num único método), não os recria.

## Fases (cada uma é um marco entregável)

1. **Fundação** — a migration da coleção `activities` (2 índices). Marco: `pnpm migrate:up` cria `activities`.
2. **Camada de dados** — `ActivityRepository` (interface + impl Mongo) e o método novo `FollowRepository.listFolloweeIds`, em ordem TDD. Marco: integração verde com `mongodb-memory-server`, incl. paginação por cursor sem duplicar/pular (cenário 11) e os 2 cascades de deleção.
3. **Emissão de eventos nos 5 pontos de escrita** — `start-reading`, `mark-finished`, `update-progress`, `finish-reading-session` (003) e `create-review` (005) passam a gravar `Activity`. Marco: cada um dos 5 specs de integração existentes ganha o `it()` que comprova a gravação (ou a ausência dela, nos casos guardados — RF-001, RF-002/idempotência).
4. **Cascade de deleção nos 2 pontos de escrita restantes** — `delete-reading-session` (003) e `delete-review` (005) passam a apagar `Activity` em cascata. Marco: cenário 10 da spec (deleção completa) e o caso de deleção só da review (D4) passam.
5. **Regra de negócio do feed** — `get-feed.service.ts` e seus DTOs. Marco: cobertura de `src/services/feed/**` ≥ 70%; os 13 cenários de aceitação passam no nível de service.
6. **Borda HTTP + fiação final do container** — schema, controller, rota `GET /v1/feed`, `app.ts` e todo o Awilix. Marco: `app.inject()` cobre os 13 cenários ponta a ponta.
7. **Documentação e fechamento** — README, checagens estruturais e execução do `quickstart.md`. Marco: Definição de Pronto toda verificável.

---

## Fase 1: Fundação

- [x] T001 Gerar via `pnpm migrate:create -- create-activities-collection` e preencher: `up` cria a coleção `activities`, `createIndex({ actorId: 1, createdAt: -1, _id: -1 })` (filtro `$in` + cursor do feed, D7 do `research.md`) e `createIndex({ readingSessionId: 1 })` (cascades de deleção, D4); `down` faz `db.collection('activities').drop()`. Arquivo: `migrations/<timestamp>-create-activities-collection.js`

## Fase 2: Camada de dados (TDD)

- [x] T002 [P] Teste de integração de `MongoActivityRepository` (TDD, `mongodb-memory-server`): `record` insere com `currentPage` só quando `type === 'progress_update'` (demais tipos sem o campo, ou `null`); `listForActors` filtra por `actorId: $in [...]`, ordena `createdAt` desc, e a paginação por cursor não duplica nem pula itens mesmo com um novo documento inserido entre duas páginas (cenário 11 do `spec.md`); `deleteBySessionId` remove documentos de **todos** os tipos daquela session; `deleteBySessionIdAndType` remove só o tipo pedido, deixando os demais tipos da mesma session intactos. Arquivo: `tests/integration/repositories/activities/mongo-activity.repository.spec.ts`
- [x] T003 [P] Criar a interface `ActivityRepository` e os tipos `ActivityType`, `ActivityRecord`, `RecordActivityInput` conforme `contracts/internal-ports.md`. Arquivo: `src/repositories/activities/activity.repository.ts`
- [x] T004 Criar `MongoActivityRepository implements ActivityRepository` recebendo `db: Db`: mapeia `_id` ↔ `id` (hex); `listForActors` reaproveita `encodeCursor`/`decodeCursor` de `src/lib` com o mesmo `$or` de `createdAt`/`_id` já usado em `reading_sessions`/`follows`. Arquivo: `src/repositories/activities/mongo-activity.repository.ts` (depende de T003; faz T002 passar)
- [x] T005 Criar o barrel `src/repositories/activities/index.ts` reexportando a interface, os tipos e `MongoActivityRepository`. Arquivo: `src/repositories/activities/index.ts` (depende de T003, T004)
- [x] T006 [P] Teste de integração novo em `MongoFollowRepository` (TDD): `listFolloweeIds(followerId)` devolve todos os `followeeId` de um usuário, sem paginação, `[]` se não seguir ninguém. Arquivo: `tests/integration/repositories/follows/mongo-follow.repository.spec.ts` (arquivo existente da 004 — só acrescenta `it()`s novos)
- [x] T007 Adicionar `listFolloweeIds(followerId: string): Promise<string[]>` à interface `FollowRepository` e implementar em `MongoFollowRepository` via `distinct('followeeId', { followerId })` (D6 do `research.md`). Arquivos: `src/repositories/follows/follow.repository.ts`, `src/repositories/follows/mongo-follow.repository.ts` (faz T006 passar)

## Fase 3: Emissão de eventos nos 5 pontos de escrita (TDD)

- [x] T008 [P] Teste de integração novo em `start-reading.service` (TDD): iniciar uma leitura nova grava `Activity{ type: 'started_reading', actorId, bookId, readingSessionId }`; reiniciar uma leitura já aberta (sessão reaproveitada, `created === false`) **não** grava um segundo evento (RF-001). Arquivo: `tests/integration/services/reading-sessions/start-reading.service.spec.ts` (existente da 003 — acrescenta `it()`s)
- [x] T009 Atualizar `makeStartReading`: `StartReadingDeps` ganha `activityRepository: ActivityRepository`; grava o evento só quando `existing === null` (D1 do `research.md`). Arquivo: `src/services/reading-sessions/start-reading.service.ts` (depende de T003; faz T008 passar)
- [x] T010 [P] Teste de integração novo em `mark-finished.service` (TDD): marcar um livro como lido diretamente grava `Activity{ type: 'finished_reading', ... }` (RF-002). Arquivo: `tests/integration/services/reading-sessions/mark-finished.service.spec.ts` (existente da 003 — acrescenta `it()`s)
- [x] T011 Atualizar `makeMarkFinished`: `MarkFinishedDeps` ganha `activityRepository: ActivityRepository` e `clock: Clock` (não tinha); grava o evento sempre, com `clock.now()`. Arquivo: `src/services/reading-sessions/mark-finished.service.ts` (depende de T003; faz T010 passar)
- [x] T012 [P] Teste de integração novo em `update-progress.service` (TDD): registrar progresso grava `Activity{ type: 'progress_update', currentPage, ... }` a cada chamada, inclusive múltiplas vezes na mesma session com valores diferentes (RF-004). Arquivo: `tests/integration/services/reading-sessions/update-progress.service.spec.ts` (existente da 003 — acrescenta `it()`s)
- [x] T013 Atualizar `makeUpdateProgress`: `UpdateProgressDeps` ganha `activityRepository: ActivityRepository` e `clock: Clock` (não tinha); grava o evento sempre, com o `currentPage` recebido. Arquivo: `src/services/reading-sessions/update-progress.service.ts` (depende de T003; faz T012 passar)
- [x] T014 [P] Teste de integração novo em `finish-reading-session.service` (TDD): finalizar uma session `reading` grava `Activity{ type: 'finished_reading', ... }`; finalizar de novo uma session já `finished` (idempotência, cenário de borda existente) **não** grava um segundo evento. Arquivo: `tests/integration/services/reading-sessions/finish-reading-session.service.spec.ts` (existente da 003 — acrescenta `it()`s)
- [x] T015 Atualizar `makeFinishReadingSession`: `FinishReadingSessionDeps` ganha `activityRepository: ActivityRepository`; grava o evento só quando `existing.status !== 'finished'`, antes de chamar `readingSessionRepository.finish` (RF-002 + nota de idempotência do `data-model.md`). Arquivo: `src/services/reading-sessions/finish-reading-session.service.ts` (depende de T003; faz T014 passar)
- [x] T016 [P] Teste de integração novo em `create-review.service` (TDD): criar uma review grava `Activity{ type: 'review_published', ... }` (RF-003). Arquivo: `tests/integration/services/reviews/create-review.service.spec.ts` (existente da 005 — acrescenta `it()`s)
- [x] T017 Atualizar `makeCreateReview`: `CreateReviewDeps` ganha `activityRepository: ActivityRepository` e `clock: Clock` (não tinha); grava o evento sempre, após `reviewRepository.create`. Arquivo: `src/services/reviews/create-review.service.ts` (depende de T003; faz T016 passar)

## Fase 4: Cascade de deleção nos 2 pontos de escrita restantes (TDD)

- [x] T018 [P] Teste de integração novo em `delete-reading-session.service` (TDD): apagar uma session que tem `started_reading`, `progress_update`(s), `finished_reading` e `review_published` remove **todos** esses eventos (cenário 10 do `spec.md`). Arquivo: `tests/integration/services/reading-sessions/delete-reading-session.service.spec.ts` (existente da 003/005 — acrescenta `it()`s)
- [x] T019 Atualizar `makeDeleteReadingSession`: `DeleteReadingSessionDeps` ganha `activityRepository: ActivityRepository`; chama `activityRepository.deleteBySessionId(sessionId)` depois de `reviewRepository.deleteBySessionId(sessionId)` (D4 do `research.md`). Arquivo: `src/services/reading-sessions/delete-reading-session.service.ts` (depende de T003; faz T018 passar)
- [x] T020 [P] Teste de integração novo em `delete-review.service` (TDD): apagar só a review (sem apagar a session) remove o evento `review_published` daquela session, mas **preserva** os demais tipos de evento da mesma session (`started_reading`, etc. — D4). Arquivo: `tests/integration/services/reviews/delete-review.service.spec.ts` (existente da 005 — acrescenta `it()`s)
- [x] T021 Atualizar `makeDeleteReview`: `DeleteReviewDeps` ganha `activityRepository: ActivityRepository`; chama `activityRepository.deleteBySessionIdAndType(existing.sessionId, 'review_published')` depois de `reviewRepository.delete(reviewId)` (D4). Arquivo: `src/services/reviews/delete-review.service.ts` (depende de T003; faz T020 passar)

## Fase 5: Regra de negócio do feed (TDD)

- [x] T022 Teste de integração de `get-feed.service` (TDD, cobre os 13 cenários de aceitação no nível de service): mistura própria atividade + de quem segue, ordenado desc (cenários 1, 13); exclui quem não é seguido/aprovação pendente/deixou de seguir (cenários 2, 3, 12); `review_published` reflete o texto/nota **atuais** após uma edição (cenário 9); `progress_update` mostra o `currentPage` gravado no evento, não o mais recente da session (D2); feed vazio sem erro quando não segue ninguém (RF-013); paginação por cursor sem duplicar/pular com evento novo inserido no meio (cenário 11); item de sessão apagada nunca aparece (cenário 10, via os cascades das Fases 3–4). Arquivo: `tests/integration/services/feed/get-feed.service.spec.ts`
- [x] T023 Criar os DTOs `FeedActorDTO`, `FeedBookDTO`, `FeedItemDTO`, `FeedCursorPageDTO` conforme `data-model.md`. Arquivo: `src/services/feed/types.ts`
- [x] T024 Criar `toFeedItemDTO(activity, actor, book, review)` combinando um `ActivityRecord` com os registros de ator/livro/review resolvidos (reaproveita `toReviewDTO` da 005 para o campo `review`). Arquivo: `src/services/feed/to-dto.ts` (depende de T003, T023)
- [x] T025 Criar `makeGetFeed({ activityRepository, followRepository, userRepository, bookRepository, reviewRepository }): GetFeed` conforme `contracts/internal-ports.md`: `listFolloweeIds` → `activityRepository.listForActors([userId, ...followeeIds], ...)` → `Promise.all` deduplicado de `userRepository.findById`/`bookRepository.findById` (D5) → `reviewRepository.findBySessionIds` em lote para os itens `review_published` (D5 da 005) → monta cada `FeedItemDTO` com `toFeedItemDTO`. Arquivo: `src/services/feed/get-feed.service.ts` (depende de T003, T007, T023, T024; faz T022 passar)
- [x] T026 Criar o barrel `src/services/feed/index.ts` reexportando `makeGetFeed`, `GetFeed`, `toFeedItemDTO` e os DTOs. Arquivo: `src/services/feed/index.ts` (depende de T024, T025)

## Fase 6: Borda HTTP + fiação final do container

- [x] T027 [P] Schema `zod` de `getFeed` (querystring) + teste unitário (TDD): `cursor` opcional (string, `min 1`), `limit` opcional (int `1..100`, default `20`) — mesmo padrão de `listReadingSessionsSchema`. Arquivos: `src/schemas/feed/get-feed.schema.ts`, `tests/unit/schemas/feed/get-feed.schema.spec.ts`
- [x] T028 Criar o barrel `src/schemas/feed/index.ts` reexportando o schema e o tipo inferido. Arquivo: `src/schemas/feed/index.ts` (depende de T027)
- [x] T029 [P] Criar `get-feed.controller.ts`: valida a querystring com `getFeedSchema`, usa `request.currentUser.id`, resolve `getFeedService`, responde `200`. Arquivo: `src/controllers/feed/get-feed.controller.ts` (depende de T027, T025)
- [x] T030 Criar o plugin de rotas do domínio `feed`: `GET /feed` com `preHandler: app.authenticate`. Arquivo: `src/controllers/feed/feed.routes.ts` (depende de T029)
- [x] T031 Criar o barrel `src/controllers/feed/index.ts` reexportando `feedRoutes` e `getFeedController`. Arquivo: `src/controllers/feed/index.ts` (depende de T029, T030)
- [x] T032 Registrar `activityRepository` (`asFunction((cradle) => new MongoActivityRepository(cradle.db))`, singleton) no registro de repositories. Arquivo: `src/container/register-repositories.ts` (depende de T004)
- [x] T033 Estender `AppCradle` com `activityRepository: ActivityRepository` e `getFeedService: GetFeed`. Arquivo: `src/container/cradle.ts` (depende de T003, T025)
- [x] T034 Registrar `getFeedService` no registro de services, e acrescentar `activityRepository: cradle.activityRepository` (+ `clock: cradle.clock` onde ainda faltava) nas factories de `startReadingService`, `markFinishedService`, `updateProgressService`, `finishReadingSessionService`, `deleteReadingSessionService`, `createReviewService`, `deleteReviewService`. Arquivo: `src/container/register-services.ts` (depende de T009, T011, T013, T015, T017, T019, T021, T025, T032, T033)
- [x] T035 Teste de integração de rotas via `buildApp` + `app.inject()` (TDD — escrito antes de T036, que faz a fiação e o torna verde) cobrindo os 13 cenários de aceitação do `spec.md` ponta a ponta: feed misto (próprio + seguidos, ordenado), exclusão de não-seguidos/pendentes/deixados de seguir, review editada refletindo ao vivo, evento removido após deleção (session inteira e review isolada), `400 VALIDATION_ERROR` em cursor inválido, `401` sem token, lista vazia sem erro, paginação sem duplicar/pular. Arquivo: `tests/integration/http/feed.routes.spec.ts` (depende de T031)
- [x] T036 Atualizar `buildApp`: registrar `feedRoutes` com `{ prefix: '/v1' }`. Arquivo: `src/app.ts` (depende de T031, T034; faz T035 passar)

## Fase 7: Documentação e fechamento

- [x] T037 [P] Acrescentar ao `README.md` a seção **Feed**: o endpoint novo (`GET /v1/feed`) com querystring e resposta, os 4 tipos de evento, a tabela de códigos de erro (de `contracts/error-codes.md` — nenhum novo, só reaproveitados) e o passo `pnpm migrate:up`. Arquivo: `README.md`
- [x] T038 Rodar `pnpm lint`, `pnpm test` (unit + integration), `pnpm test:coverage` e `pnpm build`; conferir `grep -rn "export default" src` vazio, `grep -rn "from 'mongodb'" src/services src/controllers` vazio, e o `index.ts` de `src/{controllers,services,repositories,schemas}/feed/`; sanar o que falhar. Sem arquivo fixo (ajustes pontuais onde o comando apontar). (depende de T001–T036)
- [x] T039 Executar `specs/006-activityfeed/quickstart.md` de ponta a ponta (`pnpm migrate:up` + servidor local, 3 contas A/B/C) e marcar cada item da "Definição de Pronto" no `spec.md`. Arquivo: `specs/006-activityfeed/spec.md` (depende de T038)

---

## Dependências

- **Fase 1 → todas**: a migration (T001) define os índices; validados de verdade só no `quickstart` (T039), já que `activities` não tem índice único que mude o comportamento funcional sob `mongodb-memory-server`.
- **Fase 2 → Fases 3–6**: `ActivityRepository`/`MongoActivityRepository` (T003–T005) é injetado nos 5 services de emissão (Fase 3), nos 2 de cascade (Fase 4) e no `get-feed.service` (Fase 5); `FollowRepository.listFolloweeIds` (T007) é usado só pelo `get-feed.service`.
- **Fase 3 e Fase 4 → Fase 5**: `get-feed.service` só pode ser testado (T022) depois que os eventos são gravados corretamente (Fase 3) e os cascades removem o que não deve mais aparecer (Fase 4, cenário 10 e o caso "só a review").
- **Fase 5 → Fase 6**: o service do feed (T025) precisa existir antes do controller (T029); os 7 services alterados nas Fases 3–4 precisam ter suas assinaturas finais antes da fiação única do container (T034).
- **Fase 6 → Fase 7**: `app.ts` completo (T036) é pré-requisito do `quickstart` e das checagens finais.
- Internas relevantes:
  - T001 (sem dependência de teste — validado no quickstart)
  - T002 (teste) → T003 → T004 (faz T002 passar) → T005
  - T006 (teste) → T007 (faz T006 passar)
  - T008 (teste) → T003 → T009 (faz T008 passar)
  - T010 (teste) → T003 → T011 (faz T010 passar)
  - T012 (teste) → T003 → T013 (faz T012 passar)
  - T014 (teste) → T003 → T015 (faz T014 passar)
  - T016 (teste) → T003 → T017 (faz T016 passar)
  - T018 (teste) → T003 → T019 (faz T018 passar)
  - T020 (teste) → T003 → T021 (faz T020 passar)
  - T009, T011, T013, T015, T017, T019, T021 → T022 (teste do feed precisa que os eventos já sejam gravados/cascateados corretamente)
  - T003, T023 → T024; T003, T007, T023, T024 → T025 (faz T022 passar); T024, T025 → T026
  - T027 → T028; T027, T025 → T029; T029 → T030 → T031
  - T004 → T032; T003, T025 → T033
  - T009, T011, T013, T015, T017, T019, T021, T025, T032, T033 → T034
  - T031 → T035 (escrito para falhar; T036 o faz passar)
  - T031, T034 → T036 → T038; T001–T036 → T038 → T039

## Exemplo de execução em paralelo

```
# Fase 2 — repositório novo e extensão de repositório existente (arquivos distintos):
T002 mongo-activity.repository.spec.ts | T006 mongo-follow.repository.spec.ts (novos it()s)

# Fase 3 — os 5 testes de integração de emissão de evento (arquivos distintos):
T008 start-reading | T010 mark-finished | T012 update-progress | T014 finish-reading-session | T016 create-review

# Fase 3 — as 5 implementações correspondentes, depois de T003 (arquivos distintos):
T009 start-reading.service.ts | T011 mark-finished.service.ts | T013 update-progress.service.ts
T015 finish-reading-session.service.ts | T017 create-review.service.ts

# Fase 4 — os 2 testes/implementações de cascade (arquivos distintos):
T018 delete-reading-session | T020 delete-review
T019 delete-reading-session.service.ts | T021 delete-review.service.ts

# Fase 6 — schema e controller (arquivos distintos, controller depende do schema já pronto):
T027 get-feed.schema.ts (+ teste)

# Fase 7 — T037 (README) corre em paralelo ao restante; T038/T039 são sequenciais e finais.
```

## Notas

- Ordem TDD: T002→T004, T006→T007, T008→T009, T010→T011, T012→T013, T014→T015, T016→T017,
  T018→T019, T020→T021, T022→T025, T035→T036 (o teste é escrito para falhar antes da
  implementação que o satisfaz — mesmo padrão das features 003/004/005).
- Nenhum erro novo nesta feature (`contracts/error-codes.md`) — `getFeedSchema` reaproveita
  `ValidationError` (via `ZodError` → handler global da 001) para `limit` fora do intervalo, e
  `decodeCursor` (`src/lib/pagination.ts`, já existente) para `cursor` malformado.
- `Activity` nunca guarda snapshot de review (RF-009 — resolvida ao vivo via
  `reviewRepository.findBySessionIds`), mas guarda `currentPage` no próprio evento de
  `progress_update` — é a única forma de preservar o histórico de progresso, já que
  `ReadingSessionRecord.currentPage` só mantém o valor mais recente (D2 do `research.md`).
  Não confundir os dois casos ao escrever T022/T024/T025.
- `update-progress.service.ts`/`finish-reading-session.service.ts`/`mark-finished.service.ts`
  ganham `clock: Clock` nas Deps pela primeira vez nesta feature (antes não precisavam) — checar
  os testes de integração já existentes desses 3 arquivos (que hoje instanciam `Deps` sem
  `clock`) e atualizá-los para passar um clock fixo/injetado, senão eles param de compilar.
- Nenhum service de `feed` importa `mongodb` diretamente — só `MongoActivityRepository`
  (`src/repositories/activities/**`).
- Commitar após cada tarefa concluída.
