# Especificação de Feature: Lacunas de contrato de conexões/perfil para o front-end

**Branch**: `011-userconnectionscontractgaps`
**Criado em**: 2026-09-06
**Status**: Rascunho
**Entrada**: descrição original do usuário: "Lacunas de contrato de conexões/perfil descobertas pela feature de front-end `004-userconnections` (busca de pessoas, meu perfil, editar perfil, perfil de outra pessoa, pedidos e conexões). Fechar no back-end e documentar. Quatro entregas: (D1) `GET /users/{userId}` — perfil de uma pessoa; (D2) `GET /users/{userId}/activity` — atividade recente de uma pessoa; (D3) `GET /me/stats` — contadores do próprio usuário; (D4) `followState`/`followsYou` nos DTOs de lista de usuário."

## Contexto

A feature de front-end `004-userconnections` (outro repositório) desenhou as telas de **busca de pessoas**, **meu perfil**, **editar perfil**, **perfil de outra pessoa** e **pedidos/conexões**, e descobriu que o contrato atual da API (`docs/openapi.yaml`) não expõe alguns dados de que essas telas dependem. As formas abaixo foram negociadas e **congeladas** com a sessão de front-end antes desta spec. Esta feature fecha as quatro lacunas **no backend** e atualiza a documentação.

Âncoras em `.specify/memory/product.md`:

- **P1** — modelo social é seguir assimétrico com aprovação.
- **P6** — perfil é privado por padrão; todo endpoint de leitura filtra pelo espectador; respostas de "não visível" são indistinguíveis de "não existe".
- **P13** — aprovar um follow cria só a relação `A → B`, nunca a inversa.
- **P14** — a superfície de alguém que você não segue é só `displayName` + `@handle` + `avatar`; nenhum contador nem conteúdo de leitura.

Nenhuma mudança em autenticação, no fluxo de aprovação de follow, nem no modelo **persistido** de `User`, `Follow`, `FollowRequest`, `Activity`, `Review` ou `ReadingSession` — apenas consulta e serialização. Nenhuma entidade nova, nenhuma coleção nova. Nenhuma migração de dados. Índices novos podem ser adicionados se necessários para as consultas descritas (ver Requisitos Não Funcionais).

**Bloqueio de usuário está fora do escopo** e não existe no MVP. A descrição menciona "você foi bloqueado por essa pessoa" apenas para justificar que o `404` de D1/D2 é neutro **por design** — de modo que, se um bloqueio vier a existir no futuro, ele caia no mesmo `404` sem virar `403`. Hoje os únicos gatilhos reais de `USER_NOT_FOUND` são: usuário inexistente (D1 e D2) e solicitante que não é seguidor aprovado do alvo (D2).

## Cenários de Usuário & Testes *(obrigatório)*

### História principal

Uma pessoa usando o app web quer: abrir o perfil de outra pessoa que encontrou na busca e decidir se manda (ou cancela) um pedido de follow, vendo de imediato o estado do relacionamento nos dois sentidos; quando já segue essa pessoa, espiar a atividade recente dela sem ir ao feed; ver, na própria tela de perfil, os números que resumem sua vida na rede (livros lidos, seguidores, seguindo, pedidos pendentes, "quero ler"); e, em qualquer lista de gente (resultado de busca, seguidores, seguindo, pedidos), saber em cada linha se já segue, se tem pedido pendente, ou se aquela pessoa a segue — sem o cliente precisar cruzar várias chamadas para montar o botão de follow.

### Cenários de aceitação

**D1 — `GET /users/{userId}` (perfil de uma pessoa)**

1. **Dado** um usuário-alvo que existe e que **não** sigo, **quando** chamo `GET /users/{userId}`, **então** recebo `id`, `handle`, `displayName` e `avatarUrl` do alvo, `bio` vem `null`, `followState` vem `none` e `followsYou` vem `false`.
2. **Dado** um usuário-alvo que sigo com follow **aprovado** e que tem `bio` preenchida, **quando** chamo `GET /users/{userId}`, **então** `bio` vem com o texto real, `followState` vem `following` e `followsYou` reflete se o alvo me segue de volta (aprovado).
3. **Dado** um usuário-alvo para quem tenho um pedido de follow **pendente** (ainda não aprovado nem recusado), **quando** chamo `GET /users/{userId}`, **então** `followState` vem `pending` e `bio` vem `null`.
4. **Dado** um usuário-alvo que me segue com follow aprovado mas que eu **não** sigo, **quando** chamo `GET /users/{userId}`, **então** `followsYou` vem `true`, `followState` vem `none` e `bio` vem `null`.
5. **Dado** o meu próprio `userId`, **quando** chamo `GET /users/{userId}`, **então** a chamada é aceita e retorna meu perfil com `followState: none` e `followsYou: false` (`bio` vem `null` — para os meus próprios dados uso `GET /me`).
6. **Dado** um `userId` que não corresponde a nenhum usuário (inexistente ou identificador malformado), **quando** chamo `GET /users/{userId}`, **então** recebo `404` com código `USER_NOT_FOUND` — o mesmo corpo e status que eu receberia se o usuário existisse mas não fosse visível para mim; nunca `403`, nunca `400`.
7. **Dado** que tive um pedido de follow **recusado** pelo alvo (o pedido foi apagado), **quando** chamo `GET /users/{userId}`, **então** `followState` vem `none` (posso pedir de novo) — "recusado" não é um estado distinto de `none`.

**D2 — `GET /users/{userId}/activity` (atividade recente de uma pessoa)**

8. **Dado** um usuário-alvo que sigo com follow **aprovado** e que tem atividade (começou/terminou de ler, review publicada, progresso), **quando** chamo `GET /users/{userId}/activity`, **então** recebo uma página no formato `{ items, nextCursor }` onde cada item tem exatamente a forma de um item de feed (o mesmo de `GET /feed`), ordenada por `createdAt` decrescente.
9. **Dado** o mesmo alvo com mais atividade do que cabe em uma página, **quando** pagino com o `cursor` retornado, **então** recebo o restante sem repetição e sem buraco.
10. **Dado** um usuário-alvo que **não** sigo (ou cujo follow está pendente/recusado), **quando** chamo `GET /users/{userId}/activity`, **então** recebo o mesmo `404 USER_NOT_FOUND` do cenário 6 — indistinguível de "usuário não existe"; nunca `403`.
11. **Dado** um `userId` inexistente ou malformado, **quando** chamo `GET /users/{userId}/activity`, **então** recebo `404 USER_NOT_FOUND`.
12. **Dado** o meu próprio `userId`, **quando** chamo `GET /users/{userId}/activity`, **então** a chamada é aceita e retorna a minha própria atividade (mesma que apareceria para mim no feed sobre mim mesmo).
13. **Dado** um alvo que sigo mas que ainda não tem nenhuma atividade, **quando** chamo `GET /users/{userId}/activity`, **então** recebo `items: []` e `nextCursor: null`.
14. **Dado** que a atividade do alvo inclui um item do tipo `started_reading`, **quando** listo a atividade dele, **então** esse item aparece na lista (com os mesmos campos de contagem/curtida zerados que o feed já usa), mesmo sabendo que esse tipo não aceita curtida/comentário.
15. **Dado** que eu seguia o alvo mas o follow foi desfeito (por mim ou por ele), **quando** chamo `GET /users/{userId}/activity` de novo, **então** volto a receber `404 USER_NOT_FOUND` — a autorização é sempre relativa ao estado atual de follows aprovados.

**D3 — `GET /me/stats` (contadores do próprio usuário)**

16. **Dado** que finalizei leitura de 5 livros distintos (uma ou mais reading sessions `finished` para cada), sigo 12 pessoas com follow aprovado, sou seguido por 8, tenho 3 pedidos pendentes recebidos e 4 livros em "quero ler", **quando** chamo `GET /me/stats`, **então** recebo `{ booksRead: 5, followers: 8, following: 12, pendingFollowRequests: 3, wantToRead: 4 }`.
17. **Dado** que li o mesmo livro duas vezes (duas reading sessions `finished` do mesmo livro), **quando** chamo `GET /me/stats`, **então** esse livro conta **1** em `booksRead`.
18. **Dado** que tenho reading sessions apenas com status `reading` (nenhuma `finished`), **quando** chamo `GET /me/stats`, **então** `booksRead` vem `0`.
19. **Dado** que enviei 2 pedidos de follow que ainda não foram respondidos, **quando** chamo `GET /me/stats`, **então** `pendingFollowRequests` **não** conta esses 2 (só conta os pedidos que **recebi** e ainda não respondi).
20. **Dado** um usuário recém-criado sem nenhuma atividade, **quando** chamo `GET /me/stats`, **então** recebo todos os contadores em `0`.
21. **Dado** que não envio o header de autenticação, **quando** chamo `GET /me/stats`, **então** recebo `401`.

**D4 — `followState` / `followsYou` nos DTOs de lista**

22. **Dado** que faço `GET /users/search` e o resultado inclui uma pessoa que já sigo (aprovado), uma para quem tenho pedido pendente e uma sem relação, **quando** leio a resposta, **então** cada item traz `followState` (`following` / `pending` / `none` respectivamente) e `followsYou` indicando se aquela pessoa me segue com follow aprovado.
23. **Dado** que faço `GET /me/following`, **quando** leio a resposta, **então** cada item traz `followState` (sempre `following`) e `followsYou` (indica reciprocidade — quem, dentre quem eu sigo, me segue de volta).
24. **Dado** que faço `GET /me/followers`, **quando** leio a resposta, **então** cada item traz `followsYou` (sempre `true`) e `followState` (indica se eu sigo aquela pessoa de volta, habilitando o botão "seguir de volta" no cliente).
25. **Dado** que faço `GET /me/follow-requests?direction=incoming`, **quando** leio a resposta, **então** cada item traz `followState` (meu estado em relação a quem me pediu — pode ser `none`, `pending` ou `following`) e `followsYou` (`false` enquanto o pedido não for aprovado por mim).
26. **Dado** que faço `GET /me/follow-requests?direction=outgoing`, **quando** leio a resposta, **então** cada item traz `followState` (sempre `pending`) e `followsYou` (indica se a pessoa a quem pedi já me segue).
27. **Dado** uma página de resultados com N pessoas, **quando** o servidor monta `followState`/`followsYou` para todas, **então** isso é feito com um número fixo de consultas independente de N (sem uma consulta por item).
28. **Dado** que a resposta de um desses endpoints antes desta feature não tinha `followState`/`followsYou`, **quando** um cliente antigo lê a resposta nova, **então** os campos adicionais não quebram o consumo (adição retrocompatível) — mas o schema publicado passa a exigi-los.

### Casos de borda

- **`userId` sintaticamente inválido** (não é um identificador de usuário plausível): tratado como usuário inexistente → `404 USER_NOT_FOUND`, nunca `400` — coerente com P6 e com o comportamento já existente das rotas `:userId`/`:sessionId`.
- **Perfil visto por si mesmo**: `GET /users/{meuId}` e `GET /users/{meuId}/activity` funcionam; `followState` é `none` e `followsYou` é `false` (não há relação de alguém consigo mesmo).
- **`bio` vazia vs. sem permissão**: quando `followState != following`, `bio` vem `null` e o cliente não distingue "a pessoa não escreveu bio" de "você não tem permissão de ver" — isso é intencional (P6).
- **`avatarUrl`**: vem **sempre `null`** em toda superfície desta feature — upload de avatar não existe na API. Mantido no contrato para não quebrar quando existir.
- **Atividade que referencia livro/review/reading session apagados**: `GET /users/{userId}/activity` se comporta igual ao feed já se comporta hoje nesse caso (não introduz tratamento novo).
- **Item `review_published` na atividade**: o conteúdo da review reflete o estado **atual** (ao vivo), como no feed — não um retrato do momento da publicação.
- **`GET /me/stats` com `booksRead` de um livro que saiu do catálogo**: a contagem é por reading session `finished` do usuário; segue contando enquanto a session existir.
- **Empate/consistência de `followState`**: se, por corrida, existir simultaneamente um follow aprovado e um pedido pendente para o mesmo par (não deveria acontecer no fluxo normal — pedir a quem já se segue é `409`), `following` prevalece sobre `pending`.
- **Página vazia** em `GET /users/{userId}/activity`: `items: []`, `nextCursor: null` — estado normal, não erro.

## Requisitos *(obrigatório)*

### Requisitos funcionais

**Definições compartilhadas (D1, D2, D4)**

- **RF-001**: O sistema DEVE definir `followState` como um enum de três valores, sempre relativo ao **solicitante autenticado** em relação a um usuário-alvo:
  - `none` — não há follow aprovado do solicitante para o alvo e não há pedido de follow pendente do solicitante para o alvo;
  - `pending` — há um pedido de follow do solicitante para o alvo ainda não aprovado nem recusado;
  - `following` — há follow **aprovado** do solicitante para o alvo.
- **RF-002**: O sistema DEVE definir `followsYou` como booleano verdadeiro somente quando o usuário-alvo segue o solicitante com follow **aprovado**. Um pedido pendente do alvo para o solicitante NÃO torna `followsYou` verdadeiro.
- **RF-003**: Quando ambos pudessem valer, o sistema DEVE reportar `followState: following` em vez de `pending`.

**D1 — `GET /users/{userId}`**

- **RF-004**: O sistema DEVE expor `GET /users/{userId}`, autenticado, que devolve o perfil de um único usuário identificado por `userId`.
- **RF-005**: A resposta DEVE sempre conter `id`, `handle`, `displayName` e `avatarUrl` do alvo. `avatarUrl` é `null` enquanto não houver upload de avatar na API.
- **RF-006**: A resposta DEVE conter `bio` com o texto real **somente** quando `followState` for `following`; em qualquer outro caso `bio` DEVE ser `null`.
- **RF-007**: A resposta DEVE conter `followState` e `followsYou` conforme RF-001 e RF-002.
- **RF-008**: O sistema DEVE aceitar `GET /users/{userId}` quando `userId` é o próprio solicitante, respondendo com o perfil do próprio usuário, `followState: none` e `followsYou: false`.
- **RF-009**: O sistema NÃO DEVE incluir contadores (seguidores, seguindo, livros lidos etc.) na resposta de `GET /users/{userId}` (P14).
- **RF-010**: O sistema DEVE responder `404` com código `USER_NOT_FOUND` quando `userId` não corresponde a nenhum usuário — inclusive quando o identificador é malformado. O corpo e o status DEVEM ser idênticos ao caso "o usuário existe mas não é visível para você"; o sistema NUNCA DEVE responder `403` nem `400` para essa rota por causa de `userId`.
- **RF-011**: O sistema DEVE responder `401` quando não houver autenticação válida.
- **RF-012**: Esta rota REVOGA a afirmação anterior de que "não existe endpoint de ver perfil de outra pessoa nesta API"; a documentação de fluxo DEVE ser corrigida (ver RF-030).

**D2 — `GET /users/{userId}/activity`**

- **RF-013**: O sistema DEVE expor `GET /users/{userId}/activity`, autenticado, paginado por cursor, que devolve a atividade recente de um único usuário.
- **RF-014**: O sistema DEVE autorizar `GET /users/{userId}/activity` **somente** quando o solicitante segue o alvo com follow **aprovado**, ou quando `userId` é o próprio solicitante. Em todos os demais casos (não segue, pedido pendente, pedido recusado, alvo inexistente, identificador malformado) o sistema DEVE responder `404 USER_NOT_FOUND` — o mesmo corpo e status de RF-010 —, NUNCA `403`.
- **RF-015**: Cada item da resposta DEVE ter exatamente a mesma forma de um item de `GET /feed` (reutilização do contrato de item de feed já existente), incluindo o identificador do item, que serve de `activityId` para os endpoints de interação.
- **RF-016**: A resposta DEVE ser ordenada por `createdAt` decrescente e paginada por cursor de forma estável (sem repetição nem omissão ao paginar). O parâmetro `limit` DEVE aceitar de 1 a 100, com padrão 20.
- **RF-017**: A resposta DEVE incluir todos os tipos de atividade que o feed inclui (`started_reading`, `finished_reading`, `review_published`, `progress_update`), com a mesma regra do feed para itens `started_reading` (aparecem, mas não aceitam curtida/comentário).
- **RF-018**: O conteúdo de itens `review_published` DEVE refletir o estado atual da review (ao vivo), como no feed.
- **RF-019**: O sistema DEVE responder uma página vazia (`items: []`, `nextCursor: null`) quando o alvo é acessível mas não tem atividade.
- **RF-020**: O sistema DEVE responder `401` quando não houver autenticação válida, e `400` quando `cursor` ou `limit` forem malformados.

**D3 — `GET /me/stats`**

- **RF-021**: O sistema DEVE expor `GET /me/stats`, autenticado, que devolve os contadores-resumo do próprio usuário como um objeto único.
- **RF-022**: O sistema NÃO DEVE alterar `GET /me` para carregar esses contadores — eles vivem exclusivamente em `GET /me/stats`.
- **RF-023**: `booksRead` DEVE ser o número de **livros distintos** para os quais o usuário tem **pelo menos uma** reading session com status `finished`. Reler o mesmo livro (mais de uma session `finished` do mesmo livro) conta **1**.
- **RF-024**: `followers` DEVE ser o número de follows aprovados em que o usuário é o **seguido**; `following`, o número de follows aprovados em que o usuário é o **seguidor**.
- **RF-025**: `pendingFollowRequests` DEVE ser o número de pedidos de follow **pendentes recebidos** pelo usuário (direção "incoming"). Pedidos **enviados** pelo usuário NÃO entram nessa contagem.
- **RF-026**: `wantToRead` DEVE ser o número de livros marcados como "quero ler" pelo usuário.
- **RF-027**: Todos os campos de `MyStats` DEVEM ser inteiros `>= 0`. A única resposta de erro DEVE ser `401` (sem autenticação válida).

**D4 — `followState` / `followsYou` nos DTOs de lista**

- **RF-028**: O sistema DEVE incluir `followState` (RF-001) e `followsYou` (RF-002) como campos **soltos** (sem objeto `viewer` aninhado — coerente com `docs/viewer-block.md`) em cada item de: `GET /users/search`, `GET /me/followers`, `GET /me/following`, `GET /me/follow-requests` (ambas as direções).
- **RF-029**: O sistema DEVE resolver `followState`/`followsYou` de uma página inteira com um número fixo de consultas, independente do tamanho da página (sem uma consulta por item).

**Documentação**

- **RF-030**: `docs/openapi.yaml` DEVE ser atualizado para cobrir: os endpoints `GET /users/{userId}` e `GET /users/{userId}/activity` (com o erro `USER_NOT_FOUND`), a rota `GET /me/stats` com o schema `MyStats`, e os campos `followState`/`followsYou` nos schemas `UserSearchResult`, `FollowedUser` e `FollowRequestItem`. Cada endpoint novo DEVE trazer um bloco `examples` com dados fictícios. `pnpm docs:lint` DEVE passar sem erros novos.
- **RF-031**: `docs/flows/follow-flow.md` DEVE ser atualizado para (a) revogar explicitamente a frase de que "não existe endpoint de ver perfil de outra pessoa nesta API" e (b) documentar D1, D2, D3 e D4 e a semântica de `followState`/`followsYou`. `docs/flows/feed-flow.md` DEVE mencionar `GET /users/{userId}/activity` como a visão de atividade de uma única pessoa (com a regra de autorização por follow aprovado).
- **RF-032**: O catálogo de erros (`docs/error-catalog.md`) DEVE registrar `USER_NOT_FOUND` (404) com a nota de que é neutro (não distingue inexistente de não-visível).

### Requisitos não funcionais

- **RNF-001**: As consultas em lote de `followState`/`followsYou` (D1 e D4) e a consulta de atividade por **ator único** (D2) NÃO DEVEM causar varredura de coleção. Se os índices existentes não cobrirem esses padrões de acesso, esta feature DEVE adicionar o(s) índice(s) necessário(s) (via migração de índice — não de dados) ou justificar, no plano, por que um índice existente já basta.
- **RNF-002**: Nenhuma mudança no modelo persistido de `User`, `Follow`, `FollowRequest`, `Activity`, `Review` ou `ReadingSession`. Nenhuma coleção nova. Nenhuma migração de **dados**.
- **RNF-003**: Sem regressão nas suítes existentes de `users`, `follows` e `feed`. Os únicos testes existentes que podem mudar são os que afirmam a forma exata dos DTOs de lista alterados em D4.

### Entidades-chave *(se a feature envolve dados)*

Nenhuma entidade nova. As formas de resposta introduzidas:

- **UserProfile** *(resposta de `GET /users/{userId}`)*: projeção de leitura de um usuário para quem não necessariamente é seguidor. Campos: `id`, `handle`, `displayName`, `avatarUrl` (sempre presentes); `bio` (texto só sob follow aprovado, senão `null`); `followState`, `followsYou` (relação com o solicitante). Sem contadores.
- **MyStats** *(resposta de `GET /me/stats`)*: contadores-resumo do próprio usuário. Campos: `booksRead`, `followers`, `following`, `pendingFollowRequests`, `wantToRead` — inteiros `>= 0`.
- **followState / followsYou**: par de campos de relação com o solicitante, adicionados a `UserProfile` e aos itens de `UserSearchResult`, `FollowedUser` e `FollowRequestItem`. Não são entidade — são projeção derivada das coleções `follows` e `follow_requests`.
- **Item de atividade de `GET /users/{userId}/activity`**: reutiliza integralmente o contrato de item de feed já existente (`FeedItem`). Nenhum campo novo.

---

## Definição de Pronto (Definition of Done) *(obrigatório)*

- [x] **Todos os cenários de aceitação acima passam** com testes automatizados (`vitest`), unitários e de integração, sem mock de banco (regra de negócio → integração com `mongodb-memory-server`): D1 (`getUserProfile`), D2 (`listUserActivity`), D3 (`getMyStats`) e os campos novos de D4 nos quatro endpoints de lista, cobrindo `followState`/`followsYou`, o gate de `bio`, a autorização de atividade, o `404` neutro, a contagem de `booksRead` com releitura, e a paginação estável de D2.
- [x] **`docs/openapi.yaml` atualizado e lint limpo**: cobre `GET /users/{userId}`, `GET /users/{userId}/activity`, `GET /me/stats` + `MyStats`, e `followState`/`followsYou` em `UserSearchResult`/`FollowedUser`/`FollowRequestItem`; cada endpoint novo com bloco `examples` (dados fictícios); `pnpm docs:lint` passa sem erros novos (warnings pré-existentes de `/health` toleráveis).
- [x] **Guias de fluxo atualizados**: `docs/flows/follow-flow.md` revoga a linha "não existe endpoint de ver perfil de fulano" e documenta D1–D4 + a semântica de `followState`/`followsYou`; `docs/flows/feed-flow.md` menciona `GET /users/{userId}/activity`; `docs/error-catalog.md` registra `USER_NOT_FOUND`.
- [x] **Sem regressão**: suítes existentes de `users`, `follows` e `feed` verdes; suíte completa verde; os únicos testes existentes ajustados são os que fixam a forma exata dos DTOs de lista de D4.
- [x] **Privacidade P6/P14 garantida com testes explícitos**: `bio` só sob follow aprovado; `GET /users/{userId}/activity` só para seguidor aprovado ou o próprio; `404 USER_NOT_FOUND` indistinguível entre "não existe" e "não visível"; nenhum contador de terceiro em `GET /users/{userId}`.
- [x] **Cobertura de índices/performance**: teste ou verificação (ex.: `explain`) de que as consultas em lote de `followState`/`followsYou` e a consulta de atividade por ator único usam índice (não fazem collection scan); qualquer índice novo entra como migração de índice e é documentado no plano.

---

## Esclarecimentos

*Preenchido pelo comando `/clarify`. Cada rodada adiciona uma subseção com data.*

### Sessão 2026-09-06 (durante o `/specify`)

- P: A descrição cita "você foi bloqueado por essa pessoa" como gatilho do `404` neutro. Existe feature de bloqueio? → R: Não. Bloqueio está fora do escopo e não existe no MVP. A spec só registra que o `404` é neutro **por design**, para acomodar um bloqueio futuro sem virar `403`. Gatilhos reais hoje de `USER_NOT_FOUND`: usuário inexistente (D1/D2) e não-seguidor-aprovado (D2).
- P: Definição de Pronto? → R: Padrão da feature 010 — (1) cenários de aceitação com testes vitest unit + integração; (2) `openapi.yaml` cobrindo tudo + `pnpm docs:lint` limpo; (3) `follow-flow.md`/`feed-flow.md`/`error-catalog.md` atualizados; (4) sem regressão em `users`/`follows`/`feed`; (5) privacidade P6/P14 com testes explícitos — **mais** (6) cobertura de índices/performance (sem collection scan nas consultas novas) e (7) blocos `examples` no `openapi.yaml` para cada endpoint novo.
- P: Identificador `userId` malformado em D1/D2 → `400` ou `404`? → R: `404 USER_NOT_FOUND` (tratado como inexistente), coerente com P6 e com o comportamento já existente das rotas `:userId`/`:sessionId`.

---

## Checklist de Revisão

### Qualidade do conteúdo

- [x] Sem detalhes de implementação (linguagens, frameworks, APIs internas) — nomes de endpoint e de campo fazem parte do contrato público, que é o objeto desta feature
- [x] Focado em valor para o usuário e necessidades de negócio
- [x] Escrito para stakeholders não-técnicos
- [x] Todas as seções obrigatórias preenchidas

### Completude dos requisitos

- [x] Nenhum marcador `[NEEDS CLARIFICATION]` remanescente
- [x] Requisitos são testáveis e não-ambíguos
- [x] Critérios de sucesso são mensuráveis
- [x] Escopo está claramente delimitado
- [x] Dependências e premissas identificadas
- [x] Definição de Pronto preenchida, com critérios objetivos e verificáveis (não vagos)
