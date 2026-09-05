# Fase 0 — Pesquisa: Feed de atividade

Feature: `006-activityfeed` · Data: 2026-09-04

Nenhum item do Contexto Técnico ficou como `[NEEDS CLARIFICATION]` — a stack já está travada
em `architecture.md` (reaproveitada sem alteração, nenhuma dependência nova). Esta fase registra
decisões de design que iam além do que a spec cobria explicitamente.

## D1 — `updateProgress` (003) não cria session implicitamente hoje

**Decisão**: RF-004/RF-005 e o cenário 8 da spec descrevem o caso de um progress update criar a
`ReadingSession` implicitamente (P10 do `product.md`). Ao inspecionar a 003 já implementada,
`POST /v1/reading-sessions/:sessionId/progress` (`update-progress.service.ts`) **exige um
`sessionId` existente na URL** — não existe hoje nenhuma rota que registre progresso a partir só
de um `bookId`, então esse caminho de auto-criação nunca ocorre na prática.

**Justificativa**: em vez de reabrir a spec/043 e mudar o contrato de uma feature já entregue,
mantemos RF-004/RF-005 como estão (descrevem corretamente a regra de negócio do domínio, coerente
com P10 do produto) — eles ficam **vacuamente satisfeitos** por esta feature: como nenhuma chamada
real cria uma session a partir de um progress update, nunca há um `started_reading` "extra" para
suprimir. Se uma feature futura adicionar essa rota, o serviço correspondente precisará checar o
mesmo sinal (`created`/`existing === null`, como já faz `start-reading.service.ts`) antes de
gravar um `started_reading`, e não gravar nesse caso.

**Alternativas consideradas**: editar a spec/003 para adicionar a rota de auto-criação agora —
rejeitado, está fora do escopo desta feature (feed é só sobre *registrar e ler* eventos, não sobre
mudar o fluxo de reading sessions).

## D2 — `Activity` não guarda snapshot de review, mas guarda snapshot de `currentPage`

**Decisão**: para `review_published`, o feed resolve o conteúdo (nota/texto/spoiler) **ao vivo**
via `reviewRepository.findBySessionId`/`findBySessionIds` no momento da consulta (RF-009) — não há
cópia na `Activity`. Já para `progress_update`, o valor de `currentPage` **é gravado no próprio
documento de `Activity`** no momento do evento.

**Justificativa**: `Review` é uma entidade própria, mutável, com relação 1:1 com a session — dá
pra sempre buscar "o estado atual" porque só existe um. `currentPage` na `ReadingSessionRecord`
(003) é um único campo mutável que guarda **só o valor mais recente**; não existe histórico de
valores intermediários em nenhum outro lugar. Se o feed resolvesse `progress_update` "ao vivo"
lendo `ReadingSessionRecord.currentPage`, todo evento de progresso passado da mesma session
mostraria o **mesmo** valor (o mais recente), destruindo o histórico que o próprio glossário do
produto descreve ("Progress update: ponto no tempo do progresso"). Guardar o valor no evento é a
única forma de preservar isso sem alterar o modelo da 003.

**Alternativas consideradas**: adicionar uma coleção de histórico de progresso na 003 — rejeitado,
fora de escopo e desnecessário (o próprio evento de atividade já é esse histórico).

## D3 — `started_reading`/`finished_reading` não guardam nem resolvem campos extras

**Decisão**: esses dois tipos carregam só `actorId`, `bookId`, `readingSessionId`, `createdAt`
(mais o `id`/`type`). Não repetem `startedAt`/`finishedAt` da session (nem como snapshot, nem
resolvidos ao vivo).

**Justificativa**: o próprio `createdAt` do evento **é** o instante em que a ação aconteceu — não
há necessidade de duplicar a mesma informação vinda de `ReadingSessionRecord.startedAt`/
`finishedAt`. Uma correção posterior via `editReadingSession` (RF-017 da 003, que pode ajustar
`startedAt`/`finishedAt` manualmente) não re-emite nem atualiza o evento — o feed mostra a
atividade na ordem em que ela realmente aconteceu no sistema, não uma linha do tempo reconstruída
pela correção manual. Consistente com a decisão de esclarecimento ("feed reflete estado atual")
que foi tomada especificamente sobre o *conteúdo* de review, não sobre datas de sessão.

## D4 — Deleção em cascata é feita na escrita, não filtrada na leitura

**Decisão**: `Activity` nunca fica com uma referência morta.
- Apagar uma `ReadingSession` (RF-018 da 003) apaga **toda** a `Activity` daquela session
  (`activityRepository.deleteBySessionId`), cobrindo `started_reading`, `finished_reading`, todos
  os `progress_update` e o `review_published`, de uma vez — estende `delete-reading-session.service.ts`
  (mesmo padrão já usado para apagar a `Review` em cascata na 005).
- Apagar **só** a `Review` (RF-006 da 005, sem apagar a session) apaga também o `Activity` do tipo
  `review_published` daquela session (`activityRepository.deleteBySessionIdAndType`) — estende
  `delete-review.service.ts`.

**Justificativa**: mantém a leitura do feed simples (nenhum filtro de existência por página,
nenhuma consulta extra de "a session ainda existe?") e evita que a coleção `activities` acumule
para sempre linhas mortas que seriam filtradas em toda consulta futura. Faz cada delete "arrumar
depois de si", que é o mesmo raciocínio já usado no cascade de review→session da 005.

**Alternativas consideradas**: filtrar por existência a cada leitura do feed (checar
`readingSessionRepository`/`reviewRepository` por item) — rejeitado, custo repetido a cada página
lida por cada seguidor, quando o custo de apagar é pago uma vez só, na escrita.

## D5 — Enriquecimento do item de feed (actor/book) segue o padrão já usado em `list-following`

**Decisão**: para montar `actor` (handle/displayName) e `book` (title/authors/coverUrl) de cada
item de feed, usamos `Promise.all` de `userRepository.findById`/`bookRepository.findById` sobre o
conjunto de ids **únicos** (deduplicados) presentes na página — mesmo padrão de
`list-following.service.ts`/`list-followers.service.ts` (004), que já faz `Promise.all` de
`findById` em vez de um método `findByIds` em lote.

**Justificativa**: `UserRepository`/`BookRepository` não têm hoje um `findByIds` em lote (só
`ReviewRepository` tem, porque a 005 precisou dele para `list-reading-sessions`). Criar esse
método novo em dois repositórios só para o feed é uma abstração a mais sem um segundo consumidor
hoje — não vale o custo diante do padrão já aceito no código para listas de tamanho de página
(20–100 itens, poucos ids únicos na prática por causa de reuso entre eventos do mesmo
autor/livro).

**Alternativas consideradas**: adicionar `findByIds` a `UserRepository`/`BookRepository` agora —
reconsiderar se uma feature futura precisar do mesmo lookup em outro lugar (então vale extrair).

## D6 — Filtro do feed usa a lista completa (não paginada) de quem o usuário segue

**Decisão**: nova operação `followRepository.listFolloweeIds(followerId): Promise<string[]>` —
retorna **todos** os `followeeId` de uma vez (sem cursor), via `distinct('followeeId', {
followerId })`. O feed usa `actorId: { $in: [userId, ...followeeIds] }`.

**Justificativa**: a consulta do feed precisa do conjunto completo de quem seguir para montar o
filtro `$in` de uma vez (não dá pra paginar "quem eu sigo" e "minha atividade" ao mesmo tempo sem
either perder itens ou duplicar). `listByFollower` (004) é paginado porque serve a **listagem**
"quem eu sigo" pra UI — objetivo diferente do filtro interno do feed.

**Justificativa de escala**: consistente com a decisão já registrada em `product.md`
("Feed: fan-out on read no MVP") — o custo cresce com o número de pessoas que o usuário segue, não
com o tamanho da rede toda. Migrar para feed materializado (fan-out on write) já está no roadmap
do produto se a escala exigir; não é escopo desta feature reabrir essa decisão.

**Alternativas consideradas**: nenhuma — decisão de produto já travada em `product.md`.

## D7 — Índice de `activities`

**Decisão**: índice composto `{ actorId: 1, createdAt: -1, _id: -1 }` na migration
`create-activities-collection`.

**Justificativa**: suporta ao mesmo tempo o filtro `actorId: { $in: [...] }` e a ordenação/cursor
`{ createdAt: -1, _id: -1 }` — o MongoDB resolve um `$in` sobre o prefixo do índice como múltiplos
index scans (um por valor), já ordenados pelo sufixo do índice, e faz o merge ordenado
(`SORT_MERGE`) sem precisar de sort em memória. Mesmo mecanismo de cursor (`$or` de
`createdAt`/`_id`) já usado em `reading_sessions`/`follows` (003/004), só que agora sobre um
conjunto de `actorId`s em vez de um só.
