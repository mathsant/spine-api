# Fase 0 — Pesquisa: `GET /users/suggestions` (012-followsuggestions)

Contexto técnico já fixado por `.specify/memory/architecture.md` (stack) e pela spec
(comportamento). Não há `[NEEDS CLARIFICATION]` de stack. As decisões abaixo cobrem
**como** implementar dentro da arquitetura em camadas sem novo índice e sem collection scan.

---

## D1 — Algoritmo em duas trilhas: amigos-de-amigos + fallback de popularidade

**Decisão**: o service resolve a lista em duas trilhas mutuamente exclusivas, escolhidas
pelo número de follows aprovados do viewer:

- **Trilha A (amigos-de-amigos)** — viewer segue ≥ 1 conta:
  1. `followeeIds = follows.distinct('followeeId', { followerId: viewerId })`.
  2. Agregação sobre `follows`: `$match { followerId: { $in: followeeIds } }` →
     `$group { _id: '$followeeId', mutualFollowersCount: { $sum: 1 } }`. Cada `_id` é um
     **candidato**; `mutualFollowersCount ≥ 1` por construção (RF-005).
  3. Exclusões (RF-003): remove do conjunto `viewerId` e todos os `followeeIds`
     (em memória, via `Set`); depois `followRequestRepository.filterPendingTargets(viewerId, restantes)`
     e remove os pendentes.
  4. Se sobrar 0 candidatos → resposta **vazia** (RF-008). Não cai para a Trilha B.
  5. Contagem de seguidores para desempate (RF-006.1): agregação sobre `follows`
     `$match { followeeId: { $in: candidateIds } }` → `$group { _id: '$followeeId', followerCount: { $sum: 1 } }`.
  6. `userRepository.findByIds(candidateIds)` para `handle`/`displayName`/`createdAt`.
  7. Ordena em memória por `(mutualFollowersCount desc, followerCount desc, createdAt desc, id desc)`
     e corta os **4** primeiros.
  8. `followsYou` dos 4 finais: `followRepository.filterFollowers(viewerId, top4Ids)`.

- **Trilha B (cold start / popularidade global)** — viewer segue 0 contas (RF-007):
  1. `pendingTargetIds = follow_requests.distinct('targetId', { requesterId: viewerId })`
     (um usuário novo pode já ter enviado pedidos).
  2. Agregação sobre `follows`: `$match { followeeId: { $nin: [viewerId, ...pendingTargetIds] } }` →
     `$group { _id: '$followeeId', followerCount: { $sum: 1 } }` → `$sort { followerCount: -1, _id: -1 }`
     → `$limit 4`.
  3. `userRepository.findByIds` dos ≤ 4 ids para `handle`/`displayName`.
  4. `mutualFollowersCount = 0` em todos (RF-007).
  5. `followsYou`: `followRepository.filterFollowers(viewerId, ids)`.

**Justificativa**: as duas trilhas usam só agregações com `$match` por igualdade/`$in`
em campos indexados (ver D4) e um `$group` cujo `_id` também está no índice — nenhuma
etapa faz `FETCH` de documento nem COLLSCAN. O corte fixo em 4 e o `findByIds` batelado
evitam N+1. Ordenação e desempate ficam num comparador puro (testável por unitário).

**Alternativas consideradas**:
- *Uma trilha só (amigos-de-amigos, sem fallback)*: rejeitada — a spec (RF-007) exige
  popularidade global no cold start; usuário novo veria seção sempre vazia.
- *Completar a Trilha A com populares quando rende < 4*: rejeitada — a spec (RF-008)
  decidiu explicitamente **não** completar; popularidade só no cold start.
- *`$graphLookup` para amigos-de-amigos de profundidade > 1*: fora de escopo — o produto
  quer só profundidade 1 ("seguido por quem eu sigo").

---

## D2 — `mutualFollowersCount` só como contagem, nunca a lista de nomes

**Decisão**: expor apenas o inteiro `mutualFollowersCount`. Nunca os `userId`/`handle` das
pessoas em comum.

**Justificativa**: a contagem já é derivável pelo viewer (ele vê quem segue e, como
follower aprovado, vê quem essas pessoas seguem), então não vaza nada novo (P6/P14).
Devolver a lista de nomes exigiria filtrar por visibilidade e aumentaria o payload
sem pedido de produto. A spec (Fora de escopo) trava isso.

**Alternativas consideradas**: devolver `mutualFollowers: [{handle, displayName}]` (até 3)
para o front escrever "seguido por @ana, @bruno +1" — adiado para roadmap; o front hoje
só precisa do número.

---

## D3 — Sem índice novo; a agregação de cold start é index-only, não COLLSCAN

**Decisão**: **nenhuma migration**. Todas as queries são servidas por índices que já
existem em `follows` e `follow_requests`:

| Query | Índice usado | Observação |
|---|---|---|
| `distinct('followeeId', { followerId })` | `follows_followerId_createdAt` (prefixo `followerId`) | — |
| A2: `$match {followerId: {$in}}` + `$group _id:'$followeeId'` | `follows_followerId_followeeId_unique` `{followerId:1, followeeId:1}` | ambos os campos no índice → IXSCAN sem FETCH |
| A5 / B2: `$match {followeeId: {$in|$nin}}` + `$group _id:'$followeeId'` | `follows_followeeId_followerId` `{followeeId:1, followerId:1}` (criado na 011) | idem — index-only |
| `filterPendingTargets` / `distinct('targetId', {requesterId})` | `follow_requests` unique `{requesterId:1, targetId:1}` | — |
| `filterFollowers(viewerId, ids)` = `{followeeId: viewerId, followerId: {$in}}` | `follows_followeeId_followerId` | — |
| `userRepository.findByIds` = `{_id: {$in}}` | `_id` (default) | — |

**Justificativa**: o RNF do projeto e o DoD da spec proíbem **collection scan** (COLLSCAN).
A agregação de cold start (B2) percorre o índice `follows_followeeId_followerId` inteiro
— é um `IXSCAN` completo, **não** um COLLSCAN, e não faz `FETCH` porque `$group` só
precisa de `followeeId`, que está no índice. O `explain` da agregação deve mostrar
`stage: "IXSCAN"` / `"PROJECTION_COVERED"` e nenhum `COLLSCAN`.

**Ponto de atenção de escala (não é violação)**: B2 é O(nº total de follows) porque não
tem `$match` seletivo. No MVP isso é aceitável (mesma filosofia de *fan-out on read* já
aceita no feed 006). O caminho de escala, se necessário, é desnormalizar um
`approvedFollowerCount` em `users` mantido pelo fluxo de aprovar/unfollow — o que sai do
escopo desta feature (a spec proíbe tocar no fluxo de aprovação) e vira item de roadmap.

**Alternativas consideradas**:
- *Criar índice `{followeeId: 1}`*: desnecessário — já é prefixo de dois índices existentes.
- *Materializar/cachear as sugestões*: rejeitado no MVP (spec: cálculo na hora).

---

## D4 — Borda sem `zod` porque não há entrada externa

**Decisão**: o endpoint não recebe nenhum parâmetro (nem query, nem path, nem body). O
controller só lê `request.currentUser` (posto pelo `preHandler: app.authenticate`) e
chama o service. **Nenhum schema `zod` novo.**

**Justificativa**: o princípio "validação com `zod` na borda" (constituição P3) vale para
"entrada vinda de fora do processo". Aqui não há nenhuma — a única informação é a
identidade autenticada, já validada pelo plugin de auth. Endpoints análogos sem input
(ex.: contadores) seguiriam o mesmo caminho. `GET /feed` usa `zod` porque tem `cursor`/`limit`;
esta rota não tem.

**Alternativas consideradas**: um schema que rejeita query params inesperados
(`z.object({}).strict()`) — valor marginal; find-my-way já ignora query desconhecida e o
contrato diz "sem parâmetro". Não adotado.

---

## D5 — Ordem de rota: estático vence paramétrico no find-my-way

**Decisão**: registrar `app.get('/users/suggestions', ...)` no mesmo plugin
`users.routes.ts`, junto de `/users/search` e `/users/:userId`. A ordem de registro não
importa.

**Justificativa**: o router do Fastify (`find-my-way`, radix tree) sempre prioriza rota
**estática** sobre **paramétrica**, então `/users/suggestions` casa o handler dedicado e
nunca cai em `/users/:userId` com `userId = "suggestions"`. O par `/users/search` +
`/users/:userId` já funciona assim hoje — padrão comprovado. Ainda assim, um teste de
integração cobre explicitamente que `GET /users/suggestions` não resolve como perfil.

---

## D6 — Forma da resposta: `{ items: [...] }` com no máximo 4

**Decisão**: `200` com corpo `{ "items": FollowSuggestion[] }`, `items` com `maxItems: 4`.
Sem `nextCursor`, sem `page`/`limit`/`totalItems` (não é paginado).

**Justificativa**: espelha `PopularAmongFollowingResponse` (única outra lista curta
não-paginada do contrato, também `{ items }` com `maxItems`). Um array cru no topo seria
inconsistente com o resto do contrato e mais difícil de evoluir (não caberia adicionar
metadados depois sem quebra).

**Alternativas consideradas**: array cru `FollowSuggestion[]` — rejeitado por
inconsistência com o restante do `openapi.yaml`.

---

## Telas cobertas (design)

Não há pasta `design/` neste repositório (backend puro). O consumo visual — seção
"Pessoas para seguir" do trilho direito — vive no repo de front-end (`spine-app`,
feature `005-paginatedfeed`), que trata a lista vazia escondendo a seção. Nenhuma
divergência design↔spec a registrar deste lado.
