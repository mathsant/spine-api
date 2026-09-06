# Fluxo: follow (pedido, aprovação, seguidores)

O modelo social do better-books é **seguir, assimétrico, com aprovação** (decisão de produto P1 de `product.md`) — o equivalente a um "Instagram privado". A pessoa A pede para seguir B; só depois que B aprova, A enxerga o conteúdo de B (posts, reviews, progresso, reading sessions). Aprovar **não** cria a relação inversa (P13) — se B quiser seguir A de volta, é um pedido separado.

## Passo a passo

1. **Encontrar alguém** — `GET /users/search` (`searchUsers`, tag `users`) por `@handle`/nome. Retorno mínimo: `id`, `handle`, `displayName`, `avatarUrl` — sem contadores nem conteúdo (P14), porque quem busca ainda não é seguidor aprovado.
2. **Pedir para seguir** — `POST /users/{userId}/follow-request` (`sendFollowRequest`). Idempotente: pedir de novo para quem já tem pedido pendente meu retorna `200` (não `409`) com o mesmo recurso.
3. **O alvo vê o pedido recebido** — `GET /me/follow-requests?direction=incoming` (`listFollowRequests`).
4. **Aprovar ou recusar**:
   - `POST /users/{userId}/follow-request/approve` (`approveFollowRequest`) — cria a relação `:userId → eu`. Gera notificação (`follow_approved`) para quem pediu.
   - `POST /users/{userId}/follow-request/reject` (`rejectFollowRequest`) — apaga o pedido. **Nunca gera notificação** — quem pediu não fica sabendo que foi recusado (evita constrangimento; é uma decisão de produto, RF-003 da feature de notificações).
5. **Ver quem eu sigo / quem me segue** — `GET /me/following` / `GET /me/followers` (`listFollowing`/`listFollowers`), visíveis só para o próprio usuário (P6 — nem seguidor aprovado vê a lista de outra pessoa).
6. **Desfazer** — `DELETE /users/{userId}/follow-request` (cancelar meu pedido pendente), `DELETE /users/{userId}/follow` (deixar de seguir), `DELETE /users/{userId}/follower` (remover alguém que me segue).
7. **Ver o perfil de uma pessoa** — `GET /users/{userId}` (`getUserProfile`). Ver "Perfil de uma pessoa" abaixo.
8. **Ver a atividade de uma pessoa** — `GET /users/{userId}/activity` (`listUserActivity`), só com follow aprovado. Ver abaixo.
9. **Meus contadores** — `GET /me/stats` (`getMyStats`). Ver abaixo.
10. **Sugestões de quem seguir** — `GET /users/suggestions` (`getFollowSuggestions`). Ver abaixo.

## Perfil de uma pessoa (`GET /users/{userId}`)

`getUserProfile`, autenticado. Substitui o antigo entendimento de que "não existia endpoint de ver o perfil de outra pessoa" — passa a existir, mas continua respeitando P6/P14:

- **Sempre**: `id`, `handle`, `displayName`, `avatarUrl` (este último **sempre `null`** — upload de avatar não existe na API).
- **`bio`**: só vem com texto quando você segue a pessoa com follow **aprovado** (`followState: "following"`); caso contrário vem `null` — indistinguível de "a pessoa não escreveu bio" (proposital, P6).
- **`followState`** (`none` | `pending` | `following`): o **seu** estado em relação a ela — `none` (sem relação), `pending` (você tem pedido de follow pendente para ela), `following` (você a segue, aprovado).
- **`followsYou`** (boolean): `true` só quando ela segue **você** com follow aprovado (um pedido pendente dela para você **não** conta).
- **Sem contadores de terceiro** (P14): nenhum número de seguidores/seguindo/livros aqui.
- `GET /users/{meuId}` é permitido: devolve o seu perfil com `followState: "none"`, `followsYou: false`, `bio: null` (para os seus próprios dados use `GET /me`).
- **`404 USER_NOT_FOUND`** para: `userId` inexistente **e** `userId` malformado — mesmo corpo e status que "existe mas não é visível para você". Nunca `403`, nunca `400`. Um pedido de follow **recusado** volta a `followState: "none"` (o pedido é apagado, não vira um estado distinto).

## Atividade de uma pessoa (`GET /users/{userId}/activity`)

`listUserActivity`, autenticado, paginado por cursor (mesmo cursor opaco de `GET /feed`; `limit` 1..100, default 20).

- **Acesso**: só se você segue a pessoa com follow **aprovado**, ou é você mesmo. Qualquer outro caso (não segue, pedido pendente/recusado, `userId` inexistente/malformado) responde o **mesmo `404 USER_NOT_FOUND`** de `GET /users/{userId}` — nunca `403`.
- **Formato do item**: idêntico ao de `GET /feed` (`FeedItem`) — ver `feed-flow.md`. O `id` de cada item é o `activityId` usado nos endpoints de interação.
- Página vazia (`items: []`, `nextCursor: null`) quando a pessoa é acessível mas não tem atividade. Se o follow for desfeito, volta a `404`.

## Meus contadores (`GET /me/stats`)

`getMyStats`, autenticado. Rota dedicada — `GET /me` **não** muda. Devolve `MyStats`:

- `booksRead` — livros **distintos** com pelo menos uma reading session `finished`. Reler o mesmo livro conta **1**.
- `followers` — follows aprovados em que você é o seguido.
- `following` — follows aprovados em que você é o seguidor.
- `pendingFollowRequests` — pedidos de follow **recebidos** e ainda não respondidos (os que **você** enviou não entram).
- `wantToRead` — livros que você marcou como "quero ler".

Todos inteiros `>= 0`. Único erro: `401`.

## Sugestões de quem seguir (`GET /users/suggestions`)

`getFollowSuggestions`, autenticado. Alimenta a seção "Pessoas para seguir" do trilho direito do feed (front-end `005-paginatedfeed`). **Sem nenhum parâmetro de query** (não é busca, não é paginado, não tem `limit`).

- **No máximo 4 itens.** Cada item = a superfície de `UserSearchResult` (`id`, `handle`, `displayName`, `avatarUrl` sempre `null`, `followState`, `followsYou`) **mais `mutualFollowersCount`** (inteiro): quantas das pessoas que **você** segue também seguem esse candidato.
- **Ranqueamento — amigos-de-amigos**: os candidatos são as contas seguidas (follow aprovado) por alguém que você segue. Ordena por `mutualFollowersCount` desc; desempata por nº total de seguidores aprovados do candidato, depois pela conta mais recente, depois pelo `id` (ordem estável). Todo candidato dessa trilha tem `mutualFollowersCount >= 1`.
- **Cold start** — se você **ainda não segue ninguém**, a lista cai para **popularidade global**: as contas com mais seguidores aprovados na plataforma, com `mutualFollowersCount = 0` em todas.
- **Se você segue alguém mas a rede não rende nenhum candidato novo** (tudo que suas conexões seguem você já segue, ou é você, ou tem pedido pendente), a resposta é **lista vazia** — **não** cai para popularidade.
- **`followState` é sempre `"none"`** aqui (quem você já segue ou tem pedido pendente está sempre excluído). `followsYou` pode ser `true` — quem já te segue e você ainda não segue de volta é um bom card.
- **Exclusões**: você mesmo, quem você já segue (aprovado) e quem tem follow-request **pendente** seu. Um pedido **recusado** no passado **não** exclui — a pessoa pode voltar a aparecer (não existe "bloquear" no produto).
- **Lista vazia é `200`** com `{ "items": [] }` (nunca `404`/`204`). O cliente esconde a seção quando vem vazia.
- Único erro: `401`.

## `followState` / `followsYou` nas listagens

`UserSearchResult` (`GET /users/search`), `FollowedUser` (`GET /me/followers` e `GET /me/following`) e `FollowRequestItem` (`GET /me/follow-requests`) passam a trazer `followState` e `followsYou` (mesma semântica de `GET /users/{userId}`), como campos **soltos** no item — o cliente não precisa mais cruzar `/me/following` + `/me/follow-requests` para montar o botão de follow de cada linha. Casos tautológicos: em `/me/following` `followState` é sempre `following`; em `/me/followers` `followsYou` é sempre `true`; em `follow-requests?direction=outgoing` `followState` é sempre `pending`.

## Regras de negócio não óbvias

- **Não dá para seguir a si mesmo** — `422 CANNOT_FOLLOW_SELF`.
- **Não dá para pedir de novo se já sigo** — `409 ALREADY_FOLLOWING` (o pedido só faz sentido enquanto não há follow aprovado).
- **Todo endpoint de `:userId`/`:id` que não existe ou não é seu** responde com o **mesmo** 404 que "nunca existiu" — `FOLLOW_REQUEST_NOT_FOUND`/`FOLLOW_NOT_FOUND` nunca viram `403`. Isso é proposital (P6): não vazar se um pedido/relação de outra pessoa existe.
- **Perfil é privado por padrão** (P6) — `GET /users/{userId}` existe (feature 011) e devolve a mesma superfície mínima de `GET /users/search` (`id`, `handle`, `displayName`, `avatarUrl`) mais o estado do relacionamento; `bio` e a atividade (`GET /users/{userId}/activity`) só aparecem com follow **aprovado**. Nenhum contador de terceiro é exposto (P14). "Não visível" e "não existe" respondem o mesmo `404 USER_NOT_FOUND`.
- **Auto-notificação nunca acontece** — se por algum motivo o ator de uma ação for o próprio destinatário (não deveria ser possível no fluxo normal de follow), nenhuma notificação é criada.

## Erros específicos deste fluxo

`CANNOT_FOLLOW_SELF`, `ALREADY_FOLLOWING`, `FOLLOW_REQUEST_NOT_FOUND`, `FOLLOW_NOT_FOUND`, `NOT_FOUND` (`:userId` do pedido não existe como usuário) — detalhes em `error-catalog.md`. `GET /users/suggestions` só tem `UNAUTHENTICATED` (401).
