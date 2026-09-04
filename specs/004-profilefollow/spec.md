# Especificação de Feature: Profile & Follow — perfil próprio, busca de usuário e grafo de follow

**Branch**: `004-profilefollow`
**Criado em**: 2026-09-04
**Status**: Rascunho
**Entrada**: descrição original do usuário: "profile-follow - perfil próprio (ler/editar dados do usuário autenticado) e busca de usuários por @handle/displayName (retorno mínimo: displayName, @handle, avatar, conforme P14). Sistema de follow assimétrico com aprovação (P1): enviar pedido de follow, aprovar/recusar pedido recebido, deixar de seguir, remover seguidor, listar seguidores e seguindo (com paginação). Aprovar um pedido cria só a relação A→B, sem reciprocidade automática (P13). Perfil é privado por padrão (P6): quem não é seguidor aprovado só enxerga o resultado da busca, nada de conteúdo. Não inclui nesta feature: feed de atividades, reviews, comentários/curtidas, notificações (features futuras) — apenas perfil, busca de usuário e o grafo de follow em si."

## Fluxo de execução (para o agente que preenche este documento)

1. Extraia o conceito principal da descrição do usuário.
2. Identifique atores, ações, dados e restrições envolvidos.
3. Para cada ambiguidade, marque com `[NEEDS CLARIFICATION: pergunta específica]` em vez de assumir.
4. Preencha as seções de Cenários de Usuário e Testes.
5. Gere Requisitos Funcionais — cada um deve ser testável.
6. Identifique Entidades-Chave, se o recurso envolve dados.
7. Pergunte ao usuário qual é a Definição de Pronto (DoD) — quais pontos são primordiais para isto estar DONE — e preencha essa seção com a resposta.
8. Rode o "Checklist de Revisão" abaixo antes de considerar a spec pronta.

**IMPORTANTE**: esta especificação descreve O QUÊ os usuários precisam e POR QUÊ. Evite detalhes de implementação (stack, APIs, estrutura de código) — isso é papel do `/plan`.

---

## Cenários de Usuário & Testes *(obrigatório)*

### História principal

Uma pessoa autenticada quer encontrar outros leitores e acompanhar a atividade deles. Ela edita seu próprio perfil (nome de exibição e biografia curta), busca outra pessoa pelo `@handle` ou nome, e envia um pedido de follow. A pessoa buscada recebe o pedido e decide aprovar ou recusar; só depois de aprovado é que a relação de follow passa a existir (uma via, sem reciprocidade automática). Qualquer um dos dois lados pode desfazer a relação depois — quem segue pode deixar de seguir, quem é seguido pode remover o seguidor —, e cada pessoa consulta suas próprias listas de seguidores e de quem segue.

Esta feature **não inclui**: feed de atividades, reviews, comentários/curtidas, notificações. Também não inclui exibir conteúdo de leitura de terceiros (isso é uma consequência do follow, mas os endpoints que exibem esse conteúdo pertencem às features futuras de books/reading-sessions "visão de terceiros" e feed). O que esta feature entrega é só: perfil do próprio usuário, busca de usuário, e as operações do grafo de follow (pedir, aprovar, recusar, cancelar, deixar de seguir, remover seguidor, listar seguidores/seguindo).

### Cenários de aceitação

1. **Dado** que estou autenticado, **quando** consulto meu próprio perfil, **então** recebo `displayName`, `@handle` e `bio` (podendo `bio` estar vazia/nula).
2. **Dado** que estou autenticado, **quando** edito `displayName` e/ou `bio` do meu perfil, **então** os novos valores passam a valer; `@handle` não pode ser alterado por este ou nenhum outro endpoint (imutável, P11).
3. **Dado** que estou autenticado, **quando** busco usuários por `@handle` ou `displayName`, **então** recebo uma lista paginada com, para cada resultado, apenas `displayName`, `@handle` e avatar (avatar fora de escopo nesta feature — ver Casos de borda), sem nenhum outro dado do perfil buscado.
4. **Dado** um usuário B que ainda não recebeu pedido meu nem me segue, **quando** eu (usuário A) envio um pedido de follow para B, **então** um pedido pendente é criado, visível para B como recebido e para mim como enviado.
5. **Dado** um pedido de follow pendente que eu enviei, **quando** eu o cancelo antes de B responder, **então** o pedido deixa de existir e eu posso enviar um novo pedido para B no futuro.
6. **Dado** um pedido de follow pendente recebido por mim (usuário B, de A), **quando** eu aprovo o pedido, **então** passa a existir a relação de follow A→B (A segue B) e o pedido pendente deixa de existir; nenhuma relação B→A é criada automaticamente (P13).
7. **Dado** um pedido de follow pendente recebido por mim, **quando** eu recuso o pedido, **então** o pedido é apagado (não fica registrado como "recusado") e quem pediu pode enviar um novo pedido a qualquer momento depois.
8. **Dado** que eu (A) sigo B (follow aprovado), **quando** eu deixo de seguir B, **então** a relação A→B deixa de existir; para voltar a seguir, preciso enviar um novo pedido e ele precisa ser aprovado de novo.
9. **Dado** que A me segue (segue aprovado, eu sou B), **quando** eu (B) removo A como seguidor, **então** a relação A→B deixa de existir; para A voltar a me seguir, precisa enviar um novo pedido.
10. **Dado** que estou autenticado, **quando** consulto minha lista de seguidores ou minha lista de quem eu sigo, **então** recebo uma lista paginada dessas pessoas (`displayName` + `@handle`), visível só para mim — nenhum outro usuário pode consultar minhas listas.
11. **Dado** que estou autenticado, **quando** tento enviar um pedido de follow para mim mesmo, **então** o sistema rejeita a operação com um erro claro.
12. **Dado** que eu já sigo B (follow aprovado), **quando** tento enviar um novo pedido de follow para B, **então** o sistema rejeita a operação com um erro claro (não é idempotente — diferente de `want_to_read`).

### Casos de borda

- Buscar usuário com termo vazio ou muito curto: deve ser rejeitado ou tratado como busca inválida (a ser detalhado no `/plan`, mas nunca retornar a base inteira de usuários).
- Avatar não existe como campo editável nesta feature (upload/URL de avatar ficou fora de escopo — ver Definição de Pronto/Esclarecimentos); o resultado de busca (RF-003 do glossário P14) expõe o campo como nulo/ausente até avatar existir numa feature futura.
- Enviar um pedido de follow para um usuário que já tem um pedido meu pendente: deve ser tratado como estado já existente, não deve criar um segundo pedido duplicado.
- A tenta enviar pedido para B, e B já tinha enviado um pedido (ainda pendente) para A: são pedidos independentes, em direções opostas — cada um segue seu próprio ciclo de aprovação/recusa; aprovar um não aprova o outro (P13).
- Tentar aprovar/recusar/cancelar um pedido de follow que não existe (já resolvido ou nunca existiu): deve responder como recurso não encontrado.
- Tentar remover como seguidor alguém que não me segue, ou deixar de seguir alguém que eu não sigo: deve responder como recurso não encontrado (idempotência não se aplica aqui — ver cenário 12).
- Editar perfil enviando `displayName` vazio: deve ser rejeitado (mesmo requisito de não-vazio que vale no cadastro, feature 002).
- Buscar usuário por `@handle` exato de alguém que existe: deve aparecer no resultado normalmente, mesmo sem relação de follow.

## Requisitos *(obrigatório)*

### Requisitos funcionais

- **RF-001**: O sistema DEVE permitir que um usuário autenticado consulte o próprio perfil, incluindo `displayName`, `@handle` e `bio`.
- **RF-002**: O sistema DEVE permitir que um usuário autenticado edite `displayName` e `bio` do próprio perfil, rejeitando `displayName` vazio.
- **RF-003**: O sistema NÃO DEVE permitir alteração de `@handle` por nenhum endpoint desta feature (imutabilidade, P11).
- **RF-004**: O sistema DEVE permitir que um usuário autenticado busque outros usuários por `@handle` e/ou `displayName`, retornando resultados paginados contendo apenas `displayName`, `@handle` e avatar (P14) — nenhum outro dado do perfil, contagens ou conteúdo de leitura.
- **RF-005**: O sistema DEVE permitir que um usuário autenticado envie um pedido de follow para outro usuário, criando um registro de pedido pendente.
- **RF-006**: O sistema DEVE rejeitar, com erro claro, um pedido de follow enviado por um usuário para si mesmo.
- **RF-007**: O sistema DEVE rejeitar, com erro claro, um novo pedido de follow quando já existir follow aprovado do remetente para o mesmo alvo.
- **RF-008**: O sistema DEVE tratar como estado já existente (sem criar duplicata) um novo pedido de follow quando já existir um pedido pendente do mesmo remetente para o mesmo alvo.
- **RF-009**: O sistema DEVE permitir que quem enviou um pedido de follow pendente o cancele antes de ele ser respondido, apagando o registro do pedido.
- **RF-010**: O sistema DEVE permitir que quem recebeu um pedido de follow pendente o aprove, criando a relação de follow direcional (remetente → alvo) e apagando o registro do pedido.
- **RF-011**: O sistema NÃO DEVE criar automaticamente a relação de follow inversa (alvo → remetente) ao aprovar um pedido (P13).
- **RF-012**: O sistema DEVE permitir que quem recebeu um pedido de follow pendente o recuse, apagando o registro do pedido (sem manter histórico de "recusado").
- **RF-013**: O sistema DEVE permitir, após um pedido ser recusado ou cancelado, que o mesmo remetente envie um novo pedido de follow ao mesmo alvo no futuro, sem bloqueio.
- **RF-014**: O sistema DEVE permitir que quem segue outro usuário (follow aprovado) deixe de segui-lo, removendo a relação.
- **RF-015**: O sistema DEVE permitir que quem é seguido remova um seguidor específico, removendo a relação, com o mesmo efeito de RF-014 do ponto de vista de quem segue.
- **RF-016**: O sistema DEVE responder com erro de recurso não encontrado ao tentar aprovar, recusar ou cancelar um pedido de follow que não existe (nunca existiu ou já foi resolvido).
- **RF-017**: O sistema DEVE responder com erro de recurso não encontrado ao tentar deixar de seguir alguém que não é seguido, ou remover um seguidor que não segue.
- **RF-018**: O sistema DEVE permitir que um usuário autenticado consulte a própria lista paginada de seguidores (quem me segue, aprovados).
- **RF-019**: O sistema DEVE permitir que um usuário autenticado consulte a própria lista paginada de quem segue (aprovados).
- **RF-020**: O sistema NÃO DEVE permitir que um usuário consulte a lista de seguidores ou de seguindo de outro usuário — essas listas são visíveis somente para o próprio dono.
- **RF-021**: Todos os endpoints desta feature DEVEM operar sobre usuários autenticados; nenhuma operação de perfil, busca ou follow é anônima.

### Entidades-chave *(se a feature envolve dados)*

- **User** (extensão da entidade existente desde a feature 002): ganha o campo `bio` (texto curto opcional, editável). `displayName` passa a ser editável nesta feature; `handle` continua imutável.
- **FollowRequest**: pedido de follow pendente de um usuário (`requester`) para outro (`target`). Existe só enquanto pendente — é apagado ao ser aprovado, recusado ou cancelado (não tem histórico de estado final). No máximo um pedido pendente por par ordenado `requester`/`target` ao mesmo tempo.
- **Follow**: relação direcional e aprovada de um usuário (`follower`) seguindo outro (`followee`). Criada só pela aprovação de um `FollowRequest`; nunca cria a relação inversa automaticamente. No máximo uma relação por par ordenado `follower`/`followee`.

---

## Definição de Pronto (Definition of Done) *(obrigatório)*

- [x] Todos os cenários de aceitação (1–12) desta spec passam ponta a ponta, incluindo os casos de borda listados. Verificado via `tests/integration/http/profile.routes.spec.ts`, `users.routes.spec.ts` e `follows.routes.spec.ts` (`app.inject()`) **e** manualmente contra o servidor real (`pnpm start` + MongoDB Atlas real, cluster `development`) — cobrindo `GET`/`PATCH /v1/me` (com `bio`), busca de usuário (`avatarUrl: null`, `400` com `q` de 1 char), ciclo pedir→idempotente(`200`)/novo(`201`)→cancelar→pedir de novo, self-follow (`422`), aprovar sem reciprocidade (RF-011), recusar+repedir, duplicado já seguindo (`409`), deixar de seguir + `404` na repetição, remover seguidor + `404` na repetição, e validação (`400`) de `displayName` vazio/campo `handle` no corpo.
- [x] Cobertura de teste automatizado: 320 testes (unit + integration) verdes; `pnpm test:coverage` confirma `src/services/profile`, `src/services/users` e `src/services/follows` em 100% de statements (bem acima do piso de 70%), execução sem falha de threshold.
- [x] Nenhuma regressão nas suítes já existentes de auth (002) e books/reading-sessions (003): suíte completa (`pnpm test`) permanece 100% verde, incluindo os 2 testes de auth ajustados para o campo `bio` novo em `PublicUser` (`signup.service.spec.ts`, `authenticate.service.spec.ts`).
- [x] ESLint e `tsc --noEmit` sem erros no código novo — `pnpm lint`, `pnpm typecheck` e `pnpm build` limpos.

---

## Esclarecimentos

### Sessão 2026-09-04

- P: Avatar entra no escopo desta feature (upload ou URL simples) ou fica de fora, já que o `product.md` deixa isso em aberto por depender de object storage? → R: Fica de fora desta feature.
- P: Além de `displayName` (editável) e `handle` (imutável), quais outros campos compõem o perfil editável? → R: `displayName` + `bio`.
- P: A lista de seguidores e de quem o usuário segue é visível para quem, além do próprio dono do perfil? → R: Só o dono vê a própria lista.
- P: Quando um pedido de follow é recusado, o pedido fica registrado (bloqueando novo pedido) ou é apagado? → R: Apagado; o mesmo remetente pode pedir de novo depois.
- P: Um usuário pode enviar pedido de follow pra si mesmo, ou repetir pedido/follow já aprovado? → R: Ambos são erro (não idempotente, diferente de `want_to_read`).
- P: A busca de usuário exige autenticação ou pode ser pública/anônima? → R: Exige autenticação, como o resto da API.
- P: Quem enviou um pedido de follow pendente pode cancelá-lo antes do alvo responder? → R: Sim.
- P: Quais pontos são primordiais para considerar esta feature DONE? → R: Todos os cenários de aceitação passam; cobertura de teste no gate do projeto (≥70% em `src/services/**`); sem regressão nas suítes de auth/books/reading-sessions; lint/typecheck limpos.

---

## Checklist de Revisão

*Gate automatizado verificado pelo `/specify` e revisado por `/clarify` antes do `/plan`.*

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
