# Especificação de Feature: Sugestões de quem seguir (`GET /users/suggestions`)

**Branch**: `012-followsuggestions`
**Criado em**: 2026-09-06
**Status**: Rascunho
**Entrada**: descrição original do usuário: "Endpoint GET /users/suggestions — sugestões de pessoas para seguir, usado pela seção 'Pessoas para seguir' do trilho direito do feed (spine-app, feature 005-paginatedfeed). Lista curta sem parâmetro de query, para o usuário autenticado. Exclui o próprio usuário, quem ele já segue, quem tem follow-request pendente. Perfil privado por padrão (P6) e follow com aprovação valem. Algoritmo de ranqueamento a definir. Resposta reusa o shape de usuário público existente."

---

## Contexto no produto

O modelo social do better-books é **seguir com aprovação, assimétrico** (P1), com **perfil privado por padrão** (P6): sem follow aprovado, a única superfície de descoberta hoje é `GET /users/search`, que **exige uma query** (`q`) — P14 limita o retorno a `@handle` + `displayName` + `avatar`.

O trilho direito do feed (app web, feature de front-end `005-paginatedfeed`) tem uma seção **"Pessoas para seguir"** que precisa de uma lista curta de sugestões **sem o usuário digitar nada**. Não existe endpoint para isso. Esta feature adiciona **um endpoint de leitura** que devolve essa lista.

Nada aqui muda o modelo persistido de `User`, `Follow` ou `FollowRequest` — é só consulta e serialização. Continua valendo tudo de P1/P6/P13/P14.

---

## Cenários de Usuário & Testes *(obrigatório)*

### História principal

Uma pessoa autenticada abre o feed. No trilho direito, a seção "Pessoas para seguir" mostra até 4 contas que ela ainda não segue e que provavelmente lhe interessam — priorizando quem já é seguido por gente que ela segue. A pessoa reconhece um nome, vê "seguido por 3 pessoas que você segue" e envia o pedido de follow dali mesmo. Se o sistema não tem em quem apostar, a lista volta vazia e a seção simplesmente não aparece.

### Cenários de aceitação

1. **Dado** que sigo (follow aprovado) `ana` e `bruno`, e ambos seguem `carla` (que eu não sigo), **quando** peço minhas sugestões, **então** `carla` aparece na lista com `mutualFollowersCount = 2`.
2. **Dado** que sigo `ana` (que segue `carla` e `dora`, nenhuma seguida por mim) e sigo `bruno` (que segue só `carla`), **quando** peço minhas sugestões, **então** `carla` (`mutualFollowersCount = 2`) vem antes de `dora` (`mutualFollowersCount = 1`).
3. **Dado** que as pessoas que sigo seguem, no total, 9 contas novas para mim, **quando** peço minhas sugestões, **então** recebo exatamente 4 itens (as 4 de maior `mutualFollowersCount`, com desempate determinístico).
4. **Dado** que não sigo ninguém ainda (conta recém-criada), **quando** peço minhas sugestões, **então** recebo até 4 contas mais seguidas da plataforma (excluindo eu mesmo), cada uma com `mutualFollowersCount = 0`.
5. **Dado** que sigo `ana`, mas todas as contas que `ana` segue eu já sigo (ou sou eu, ou tenho pedido pendente para elas), **quando** peço minhas sugestões, **então** recebo uma lista vazia — **sem** completar com contas populares.
6. **Dado** que `eva` já me segue e eu não a sigo de volta, e `eva` também é seguida por `ana` (que eu sigo), **quando** peço minhas sugestões, **então** `eva` aparece com `followsYou = true` e `followState = "none"`.
7. **Dado** que tenho um follow-request **pendente** para `felipe`, **quando** peço minhas sugestões, **então** `felipe` **não** aparece, mesmo que seja seguido por várias pessoas que eu sigo.
8. **Dado** que pedi para seguir `gabi` no passado e ela **recusou**, **quando** peço minhas sugestões, **então** `gabi` **pode** voltar a aparecer normalmente (recusa não deixa rastro).
9. **Dado** um token ausente ou inválido, **quando** chamo o endpoint, **então** recebo o erro de não autenticado (mesmo comportamento das demais rotas protegidas).

### Casos de borda

- **Lista vazia é resultado normal**, não erro: resposta de sucesso com `items: []`. O front esconde a seção. Nunca `404`/`204`.
- **Menos de 4 amigos-de-amigos**: devolve só quem qualifica (0 a 3 itens). Popularidade global **só** entra no cold start (não sigo ninguém), nunca como preenchimento.
- **Candidato seguido por várias pessoas que eu sigo**: aparece **uma vez**; `mutualFollowersCount` é a contagem de pessoas **distintas** que eu sigo e que seguem esse candidato.
- **Empate de `mutualFollowersCount`**: a ordem é resolvida por critério determinístico (ver RF-006) para a resposta ser estável entre chamadas com o mesmo estado.
- **`followState` sempre `"none"`** nesta rota — quem eu já sigo ou tenho pendente está sempre excluído. O campo é mantido só para o item ter o mesmo shape do resultado de busca.
- **Pedido de follow que me enviaram e ainda está pendente** (incoming) não exclui a pessoa: eu ainda posso querer segui-la; ela pode aparecer se qualificar.
- **Poucos usuários na plataforma**: cold start pode devolver menos de 4 (ou 0) — sem erro.
- **Auto-referência**: o próprio usuário autenticado nunca aparece na própria lista.

---

## Requisitos *(obrigatório)*

### Requisitos funcionais

- **RF-001**: O sistema DEVE expor uma operação de leitura autenticada que devolve uma lista de sugestões de contas para o usuário autenticado seguir, **sem parâmetros de query** (nem busca, nem paginação, nem `limit`).
- **RF-002**: A lista DEVE conter **no máximo 4** itens.
- **RF-003**: A lista DEVE **excluir**: (a) o próprio usuário autenticado; (b) contas que ele já segue com follow aprovado; (c) contas para as quais ele tem um follow-request **pendente** (outgoing). Um follow-request **recusado** no passado NÃO exclui a conta.
- **RF-004**: Quando o usuário segue **pelo menos uma** conta (follow aprovado), os candidatos DEVEM ser as contas seguidas (follow aprovado) por **alguma** das contas que o usuário segue, após aplicar as exclusões de RF-003. Cada candidato DEVE ter `mutualFollowersCount ≥ 1`.
- **RF-005**: `mutualFollowersCount` de um candidato DEVE ser o número de contas **distintas** que (i) o usuário autenticado segue com follow aprovado **e** (ii) seguem esse candidato com follow aprovado.
- **RF-006**: Os candidatos DEVEM ser ordenados por `mutualFollowersCount` **decrescente**; empates DEVEM ser resolvidos, nesta ordem, por: (1) número total de seguidores aprovados do candidato, decrescente; (2) data de criação da conta do candidato, mais recente primeiro; (3) identificador da conta, para garantir ordem total e estável. Os 4 primeiros compõem a resposta.
- **RF-007**: Quando o usuário **não segue nenhuma** conta (follow aprovado), o sistema DEVE cair para **popularidade global**: as contas com maior número de seguidores aprovados, após as exclusões de RF-003, ordenadas pelo mesmo critério de desempate de RF-006 a partir do item (1). Nesse caso `mutualFollowersCount` de cada item DEVE ser `0`.
- **RF-008**: Quando o usuário segue alguma conta mas o conjunto de candidatos de RF-004 fica **vazio** após as exclusões, a resposta DEVE ser uma **lista vazia** — o sistema NÃO DEVE completar com popularidade global.
- **RF-009**: Cada item da resposta DEVE conter exatamente: `id`, `handle`, `displayName`, `avatarUrl`, `followState`, `followsYou`, `mutualFollowersCount`. Os seis primeiros têm o mesmo significado do resultado de `GET /users/search`; `followState` é sempre `"none"` nesta rota; `followsYou` é `true` se o candidato já segue o usuário autenticado (follow aprovado). Nenhum conteúdo de leitura (reviews, progresso, contadores de livros) é exposto (P6/P14).
- **RF-010**: `avatarUrl` DEVE ser sempre `null` por enquanto (upload de avatar ainda não existe na API) — consistente com as demais rotas.
- **RF-011**: Uma lista vazia DEVE ser retornada como **resposta de sucesso** (não `404`, não `204`, não erro). O consumidor (front) trata lista vazia escondendo a seção.
- **RF-012**: Sem credencial válida, o endpoint DEVE responder com o mesmo erro de não autenticado das demais rotas protegidas.
- **RF-013**: A resposta para o mesmo usuário, com o mesmo estado de `follows`/`follow_requests` no banco, DEVE ser **determinística** (mesma ordem e mesmo conteúdo) — garantido pela ordem total de RF-006.
- **RF-014**: As consultas introduzidas por esta feature NÃO DEVEM fazer varredura de coleção (collection scan) — devem se apoiar em índice (RNF do projeto).

### Fora de escopo

- **Dispensar sugestão** (marcar "não me mostre essa pessoa" / botão X no card) — fica para o roadmap. O design degrada sem isso.
- **Paginação / "ver mais"** — a lista é sempre curta e única.
- Parâmetro `limit` ou qualquer outro query param.
- Sinais de ranqueamento além de amigos-de-amigos e popularidade global (atividade recente, gênero em comum, recência de cadastro como sinal primário, etc.).
- Qualquer mudança em auth, no fluxo de follow-request/aprovação, ou no modelo persistido de `User`/`Follow`/`FollowRequest`.
- Expor **quais** pessoas em comum seguem o candidato (só a contagem `mutualFollowersCount`).
- Cache/materialização das sugestões — cálculo na hora, como o feed (fan-out on read).

### Entidades-chave *(se a feature envolve dados)*

Nenhuma entidade persistida nova. A feature só lê `User`, `Follow` e `FollowRequest` existentes.

- **FollowSuggestion** (conceito de resposta, derivado — não persistido): uma conta sugerida para o usuário autenticado seguir. Atributos: `id`, `handle`, `displayName`, `avatarUrl`, `followState` (sempre `none` aqui), `followsYou` (booleano), `mutualFollowersCount` (inteiro ≥ 0). Calculada a partir do grafo de `Follow` aprovados relativo ao usuário autenticado.

---

## Definição de Pronto (Definition of Done) *(obrigatório)*

- [ ] `docs/openapi.yaml` descreve `GET /users/suggestions` (operação + schema do item com `mutualFollowersCount` + resposta de lista com no máximo 4), e o contrato passa no lint sem novo warning.
- [ ] Testes de integração cobrem, no mínimo: ranqueamento por `mutualFollowersCount` (com desempate), as três exclusões de RF-003 (self / já segue / pedido pendente), o cap de 4 itens, o cold start (não segue ninguém → popularidade global, `mutualFollowersCount = 0`), e a lista vazia quando amigos-de-amigos rende 0 (sem cair para popularidade).
- [ ] As queries novas usam índice — verificado que não há collection scan (mesmo rigor das features 010/011).
- [ ] A resposta não vaza nada além do que `GET /users/search` já expõe (`handle`/`displayName`/`avatarUrl` + `followState`/`followsYou`) mais `mutualFollowersCount`; nenhum conteúdo de leitura. P6/P14 preservados.
- [ ] `docs/flows/follow-flow.md` (e/ou `feed-flow.md`) menciona a rota de sugestões e a regra de degradação graciosa (seção some quando a lista vem vazia). `docs/flows/error-catalog.md` atualizado se surgir algum erro específico (não previsto além de `UNAUTHENTICATED`).
- [ ] Sem regressão nos fluxos existentes de follow, busca de usuário e feed.

---

## Esclarecimentos

*Preenchido pelo comando `/clarify`. Cada rodada adiciona uma subseção com data.*

### Sessão 2026-09-06

- P: Qual sinal principal ordena as sugestões? → R: **Só amigos-de-amigos** — candidatos são quem é seguido por gente que o usuário segue; ordenados por número de seguidores em comum.
- P: O que a lista faz quando o usuário ainda não segue ninguém? → R: **Cai para popularidade global** — as contas mais seguidas da plataforma.
- P: O que cada item da resposta traz? → R: **Igual ao `UserSearchResult` + `mutualFollowersCount`** (quantas pessoas que você segue também seguem o candidato).
- P: Tamanho da lista e parâmetro de limite? → R: **Fixo em 4, sem parâmetro de query.**
- P: Quando amigos-de-amigos rende menos que 4? → R: **Devolve só os amigos-de-amigos** (0 a 3). Popularidade global só no cold start.
- P: Um follow-request recusado no passado exclui a pessoa? → R: **Não exclui.** Exclusões: self, follows aprovados, pedidos pendentes.
- P: "Dispensar sugestão" faz parte desta feature? → R: **Fora de escopo.**
- P: Definição de Pronto? → R: contrato + testes cobrindo as regras; sem collection scan; privacidade P6/P14 respeitada; guia de fluxo atualizado.

---

## Checklist de Revisão

### Qualidade do conteúdo

- [x] Sem detalhes de implementação (linguagens, frameworks, APIs)
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
