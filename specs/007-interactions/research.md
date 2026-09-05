# Fase 0 — Pesquisa: Interações (comentar e curtir)

Feature: `007-interactions` · Data: 2026-09-04

Nenhum item do Contexto Técnico ficou como `[NEEDS CLARIFICATION]` — a stack já está travada em
`architecture.md` (reaproveitada sem alteração, nenhuma dependência nova). Esta fase registra
decisões de design que iam além do que a spec cobria explicitamente.

## D1 — Resolver e validar o alvo via um helper reaproveitável, não duplicado em 4 services

**Decisão**: novo `ActivityRepository.findById(activityId): Promise<ActivityRecord | null>` (único
método novo nesse port). A checagem "o alvo existe, não é `started_reading`, e o viewer pode vê-lo
(é o dono OU segue aprovado)" vira uma função só, `resolveVisibleActivity`, em
`src/services/activities/resolve-visible-activity.ts` — reaproveitada por
`create-comment`, `list-comments`, `create-reaction` e `delete-reaction`. `delete-comment` não
precisa dela (ver D6).

**Justificativa**: essa checagem é idêntica nos 4 pontos e teria que reimplementar a mesma
combinação de `followRepository.exists` + comparação de `actorId` toda vez. O projeto já tem um
precedente exato para "resolver + validar uma entidade de outro domínio e reaproveitar entre
services": `resolveBook` (`src/services/books/resolve-book.ts`), importado por
`mark-finished.service.ts` e outros services de `reading-sessions`. `resolve-visible-activity.ts`
segue o mesmo padrão — pasta de domínio própria (`services/activities`), sem rota HTTP associada,
só para reuso interno.

**Alternativas consideradas**: duplicar a checagem em cada service (rejeitado — 4 cópias da mesma
regra de negócio, risco de uma delas divergir se P6 mudar) — chamar `followRepository.exists`
direto no controller (rejeitado — regra de negócio não pode morar em controller, princípio da
constituição).

## D2 — `started_reading` é rejeitado com um erro de negócio dedicado, não "não encontrado"

**Decisão**: `resolveVisibleActivity` primeiro resolve existência+visibilidade (`ActivityNotFoundError`,
404, se não existe ou não é visível) e só depois checa o tipo — `type === 'started_reading'` lança
`UnsupportedActivityInteractionError` (422).

**Justificativa**: são duas falhas de natureza diferente. RF-012/RF-015 tratam de **privacidade**
(não revelar se o item existe) — por isso usam o mesmo código para "não existe" e "existe mas não
é seu/seguido", 404. RF-011 é uma **regra de escopo do produto** sobre um item que o viewer **pode**
ver perfeitamente (ele aparece no feed normalmente) — devolver 404 aqui seria enganoso (o cliente
já sabe que o item existe, porque acabou de renderizá-lo do feed). Um 422 com mensagem própria
deixa claro que a ação não é suportada para esse tipo, não que o item sumiu.

**Alternativas consideradas**: usar `ValidationError` genérico (400) para o caso de tipo não
suportado — rejeitado; o projeto reserva `ValidationError` para falha de schema (`zod`) na borda,
e isso é uma regra de negócio, não uma falha de shape do payload — mesmo raciocínio que já levou a
`CannotFollowSelfError`/`ReviewAlreadyExistsError` serem erros de domínio próprios em vez de
`ValidationError`.

## D3 — Cascade de `Comment`/`Reaction` via denormalização, sem alterar a assinatura do `ActivityRepository`

**Decisão**: `Comment` e `Reaction` guardam, além de `activityId`, os campos denormalizados
`readingSessionId` e `activityType` (copiados do `ActivityRecord` resolvido no momento da criação).
Isso habilita dois métodos de cascade em cada repositório novo, espelhando exatamente os dois que
`ActivityRepository` já tem (006, D4):
- `deleteByReadingSessionId(readingSessionId)` — cascade de `delete-reading-session` (RF-013,
  qualquer tipo de activity da session).
- `deleteByReadingSessionIdAndType(readingSessionId, 'review_published')` — cascade de
  `delete-review` (RF-013, só o tipo `review_published`).

**Justificativa**: a alternativa óbvia seria `activityRepository.deleteBySessionId`/
`deleteBySessionIdAndType` **retornarem** os `activityId`s apagados, e os services de cascade
repassarem essa lista para `commentRepository.deleteByActivityIds`/`reactionRepository.deleteByActivityIds`.
Isso mudaria a assinatura de um port já entregue (006) só para servir um consumidor novo — a
denormalização evita tocar em `ActivityRepository` e é o **mesmo raciocínio** que a própria
`Activity` já usa para `bookId` (denormalizado da `ReadingSession` "para evitar `$lookup` na
leitura", conforme `data-model.md` da 006). Aqui é para evitar um `$lookup`/ida extra na **escrita**
de cascade, com o mesmo trade-off já aceito no projeto.

**Alternativas consideradas**: mudar o retorno de `deleteBySessionId`/`deleteBySessionIdAndType`
para `Promise<string[]>` — rejeitado, quebra um port estável de uma feature já entregue por um
ganho pequeno. Fazer `commentRepository`/`reactionRepository` consultarem `activityRepository`
antes de cada cascade para descobrir os ids — rejeitado, uma consulta a mais por delete sem
necessidade quando denormalizar resolve na escrita (mesmo padrão já aceito no projeto).

## D4 — Curtida é um upsert idempotente com índice único, mesmo padrão de `shelf_memberships`

**Decisão**: `reactionRepository.add(activityId, userId, ...)` faz
`updateOne({ activityId, userId }, { $setOnInsert: {...} }, { upsert: true })`, e a coleção tem
índice único `{ activityId: 1, userId: 1 }`.

**Justificativa**: é literalmente o mesmo requisito de idempotência que `ShelfMembershipRepository.add`
já resolve (`want_to_read` idempotente, P do `product.md` sobre idempotência de curtir/seguir/
marcar). Reaproveitar o padrão em vez de inventar um novo evita, por exemplo, ter que lidar com erro
de duplicidade (`code 11000`) na camada de service — o `upsert` absorve isso no próprio banco.

**Alternativas consideradas**: `insertOne` protegido por `try/catch` do erro de duplicidade (código
`11000`) — rejeitado, mais código para o mesmo resultado que `$setOnInsert` + `upsert` já dá de
graça.

## D5 — Ordem dos comentários é cronológica ascendente (mais antigo primeiro)

**Decisão**: `commentRepository.listByActivity` pagina por cursor ordenado
`{ createdAt: 1, _id: 1 }` (ascendente) — índice `{ activityId: 1, createdAt: 1, _id: 1 }`.

**Justificativa**: a spec (RF-008) pede só "ordem cronológica", sem fixar a direção. Todo cursor já
existente no projeto (feed, `reading_sessions`, `follows`) é **descendente** porque serve listas
"mais recente primeiro" (atividade, histórico). Uma thread de comentário é uma conversa — lida de
cima para baixo na ordem em que aconteceu, como qualquer thread de comentários de rede social —
então ascendente é o que "cronológica" quer dizer nesse contexto específico, mesmo sendo a primeira
vez que o projeto pagina algo assim. O mecanismo de cursor (`$or` de `createdAt`/`_id`) é o mesmo,
só o sinal da comparação inverte.

**Alternativas consideradas**: descendente (mais novo primeiro), por consistência mecânica com o
resto do projeto — rejeitado, priorizar "mesma direção que as outras listas" sobre "o que faz
sentido para o caso de uso" produziria uma thread de comentário que lê de baixo para cima, que é
pior experiência sem nenhum ganho técnico real.

## D6 — Apagar o próprio comentário não passa por `resolveVisibleActivity`

**Decisão**: `delete-comment.service.ts` só checa `comment.authorId === userId` (mesmo padrão de
`delete-review.service.ts`: "existe e é meu, senão `CommentNotFoundError`"); não valida se o
viewer ainda enxergaria a `Activity` associada.

**Justificativa**: apagar é uma ação sobre o **próprio conteúdo**, não uma leitura do item de feed.
Se o autor perdeu acesso ao item (dono revogou o follow depois, caso de borda da spec) ele ainda
deve poder remover algo que ele mesmo escreveu — mesmo raciocínio de "não há remoção retroativa" já
descrito na spec para esse caso de borda. Exigir visibilidade atual para apagar criaria um estado
estranho: um comentário que o autor não consegue mais apagar porque perdeu acesso ao post.

**Alternativas consideradas**: nenhuma — segue o precedente direto de `delete-review.service.ts`
(005), que também não revalida nada além da posse.

## D7 — `hasReacted`/contador de curtida no feed reaproveita o padrão de lookup em lote da 006 (D5)

**Decisão**: `get-feed.service.ts` (006) ganha a dependência `reactionRepository` e, para o
conjunto de `activityId`s únicos da página, faz em paralelo:
`reactionRepository.countByActivityIds(activityIds)` (contador por item) e
`reactionRepository.listReactedActivityIds(viewerId, activityIds)` (quais desses o viewer curtiu).
`FeedItemDTO` ganha `reactionsCount: number` e `hasReacted: boolean` (campos simples, não um bloco
`viewer` aninhado — nenhum outro DTO do projeto usa esse formato ainda; ver D8).

**Justificativa**: é exatamente o mesmo formato de "1-2 lookups em lote sobre os ids únicos da
página" que `get-feed.service.ts` já faz para `actor`/`book`/`review` (D5 da 006) — mesma forma,
domínio novo. RF-004 exige expor isso "para cada item de feed consultado", e o feed é hoje o único
lugar onde os itens aparecem em lista.

**Alternativas consideradas**: expor via um endpoint dedicado `GET /v1/activities/:id/reactions/summary`
separado — rejeitado, RF-004 já fala do item de feed, e forçar uma segunda chamada por item da
página seria N+1 do lado do cliente sem necessidade.

## D8 — Sem bloco `viewer` aninhado ainda

**Decisão**: `reactionsCount`/`hasReacted` entram como campos de primeiro nível no `FeedItemDTO`,
não dentro de um objeto `viewer: {...}`.

**Justificativa**: `product.md` menciona um futuro bloco `viewer` (`isFollowing`, `followState`,
`hasReacted`, `myReadingStatus`) como possibilidade de design, mas nenhum DTO do projeto o
implementa hoje — `FeedItemDTO` (006) é inteiramente plano. Introduzir a primeira instância desse
padrão como efeito colateral desta feature seria uma decisão maior que o escopo daqui (afetaria a
convenção de todos os DTOs futuros) e não foi pedida pela spec. Mantém consistência com o que
existe agora; pode ser revisitado como refactor dedicado se/quando mais campos "do ponto de vista
do viewer" aparecerem.

**Alternativas consideradas**: introduzir `viewer.hasReacted` já nesta feature — rejeitado, decisão
de convenção de DTO que extrapola o escopo de "comentar e curtir".
