# Especificação de Feature: Feed de atividade

**Branch**: `006-activityfeed`
**Criado em**: 2026-09-04
**Status**: Rascunho
**Entrada**: descrição original do usuário: "Feed de atividade: log append-only de eventos (começou a ler, terminou de ler, publicou review, progress update) e endpoint de feed paginado por cursor, mostrando apenas atividade de usuários que o usuário autenticado segue com follow aprovado (P1/P6)."

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

Como usuária que segue outras pessoas no better-books (com follow aprovado), eu quero
ver, num único lugar e em ordem cronológica, o que quem eu sigo está lendo, terminando
de ler, avaliando e atualizando — para acompanhar a atividade de leitura do meu círculo
sem precisar visitar o perfil de cada pessoa individualmente. O feed é sempre a visão
mais atual dos dados: se uma review é editada ou uma reading session é apagada, o item
correspondente no meu feed reflete isso na hora (edição) ou desaparece (exclusão).

### Cenários de aceitação

1. **Dado** que eu sigo (com follow aprovado) as usuárias B e C, e ambas têm atividade
   recente, **quando** eu abro meu feed, **então** vejo os eventos de B e C juntos,
   ordenados do mais recente para o mais antigo.
2. **Dado** que eu sigo B mas meu pedido de follow para D ainda está pendente (não
   aprovado), **quando** D publica uma review, **então** essa review não aparece no meu
   feed.
3. **Dado** que eu **não** sigo E, **quando** E começa a ler um livro, **então** esse
   evento não aparece no meu feed.
4. **Dado** que B chama explicitamente o start de uma reading session, **quando** o feed
   é consultado, **então** aparece um evento "começou a ler" para essa session.
5. **Dado** que B finaliza uma reading session (com ou sem ter chamado start antes —
   P10), **quando** o feed é consultado, **então** aparece um evento "terminou de ler"
   para essa session.
6. **Dado** que B publica uma review numa reading session finalizada, **quando** o feed
   é consultado, **então** aparece um evento "publicou review" com o conteúdo atual da
   review (nota, texto, flag de spoiler).
7. **Dado** que B registra um progress update (ex.: página 120) numa reading session já
   existente, **quando** o feed é consultado, **então** aparece um evento "progress
   update" com o progresso registrado.
8. **Dado** que B ainda não tem uma reading session `reading` para um livro e registra um
   progress update, que por regra (P10) cria a session implicitamente, **quando** o feed
   é consultado, **então** aparece **apenas** o evento "progress update" (não aparece um
   evento "começou a ler" separado para essa criação implícita).
9. **Dado** que B editou o texto de uma review depois de publicá-la, **quando** eu
   consulto meu feed, **então** o evento "publicou review" de B mostra o texto/nota
   atuais da review, não os do momento original da publicação.
10. **Dado** que B apaga uma reading session que tinha gerado eventos no feed (início,
    progress updates, término, review em cascata — 005), **quando** eu consulto meu
    feed, **então** nenhum desses eventos aparece mais.
11. **Dado** que eu tinha uma página de feed carregada e, antes de eu pedir a próxima
    página, B gera um novo evento mais recente que todos os já carregados, **quando** eu
    peço a próxima página com o cursor recebido, **então** não vejo o evento novo
    duplicado nem perco/pulo nenhum item que já deveria estar entre as páginas.
12. **Dado** que eu deixo de seguir B (ou removo a aprovação, ou B deixa de me aprovar),
    **quando** eu consulto meu feed depois disso, **então** a atividade de B não aparece
    mais, incluindo eventos antigos gerados enquanto o follow ainda existia.
13. **Dado** que eu mesma inicio uma leitura, finalizo, avalio ou registro progresso,
    **quando** eu consulto meu próprio feed, **então** meus próprios eventos aparecem
    misturados cronologicamente com os de quem eu sigo.

### Casos de borda

- Eu não sigo ninguém (ou ninguém que sigo tem atividade ainda): feed retorna lista
  vazia, não erro.
- Um evento cuja entidade de origem (reading session ou review) foi apagada entre o
  registro do evento e a consulta do feed: o evento não aparece (ver cenário 10) — o
  feed nunca resolve para uma entidade inexistente.
- `cursor` inválido/malformado enviado pelo cliente: erro de validação (`400`), mesmo
  padrão já usado em `listWantToRead`/`listReadingSessions` (003) e nas listas de
  follow (004).
- Um mesmo usuário aparece nos meus "seguindo" mais de uma vez não é possível (índice
  único existente em `follows` — 004), então não há risco de evento duplicado por esse
  motivo.

## Requisitos *(obrigatório)*

### Requisitos funcionais

- **RF-001**: O sistema DEVE registrar um evento de atividade do tipo `started_reading`
  sempre que uma reading session for iniciada por uma chamada explícita de start (não
  quando a session for criada implicitamente por um progress update — RF-005).
- **RF-002**: O sistema DEVE registrar um evento de atividade do tipo `finished_reading`
  sempre que uma reading session for finalizada (com ou sem `startedAt` prévio, por
  P10), incluindo quando marcada diretamente como `finished`.
- **RF-003**: O sistema DEVE registrar um evento de atividade do tipo `review_published`
  sempre que uma review for criada numa reading session.
- **RF-004**: O sistema DEVE registrar um evento de atividade do tipo `progress_update`
  sempre que um progress update for registrado numa reading session, inclusive quando
  esse progress update cria a reading session implicitamente (P10).
- **RF-005**: Quando um progress update cria a reading session implicitamente (P10), o
  sistema NÃO DEVE registrar um evento `started_reading` adicional — apenas o evento
  `progress_update` (cenário 8).
- **RF-006**: O sistema DEVE expor um endpoint de feed que retorna, para o usuário
  autenticado, os eventos de atividade de todos os usuários que ele segue com follow
  aprovado (P1/P6), em ordem cronológica decrescente (mais recente primeiro).
- **RF-007**: O feed NÃO DEVE incluir eventos de usuários que o usuário autenticado não
  segue, ou cujo follow ainda está pendente de aprovação, ou cujo follow foi desfeito
  (cenários 2, 3, 12).
- **RF-008**: O feed DEVE incluir também a própria atividade do usuário autenticado
  (eventos gerados por ele mesmo), misturada cronologicamente com a de quem ele segue —
  o feed é pessoal + social combinado, não só do círculo seguido.
- **RF-009**: Cada evento de atividade `review_published` retornado pelo feed DEVE
  refletir o estado **atual** da review (nota, texto, flag de spoiler), não uma cópia do
  momento da publicação (cenário 9) — o feed não guarda snapshot do conteúdo.
- **RF-010**: Um evento cuja entidade de origem (reading session e/ou review) não existe
  mais (apagada) NÃO DEVE aparecer no feed (cenário 10).
- **RF-011**: O endpoint de feed DEVE ser paginado por cursor opaco, no mesmo padrão já
  usado em `listWantToRead`/`listReadingSessions` (003) e nas listas de follow (004),
  sem duplicar nem pular itens entre páginas mesmo com eventos novos inseridos entre
  duas chamadas consecutivas (cenário 11).
- **RF-012**: O sistema DEVE validar o `cursor` recebido e responder `400` de validação
  para um cursor malformado, no mesmo padrão de erro já usado nas features anteriores.
- **RF-013**: O sistema DEVE responder o feed com lista vazia (não erro) quando o
  usuário autenticado não segue ninguém com follow aprovado, ou quando ninguém que ele
  segue tem atividade registrada.

### Entidades-chave

- **Activity**: evento de atividade, append-only. Atributos-chave: `type`
  (`started_reading` | `finished_reading` | `review_published` | `progress_update`),
  `actorId` (usuário que gerou o evento), `readingSessionId` (referência à reading
  session de origem — 003), `bookId`, `createdAt` (instante do evento, chave de
  ordenação/cursor). Não guarda cópia do conteúdo de review/progresso — só referências,
  resolvidas para o estado atual no momento da consulta do feed (RF-009).

---

## Definição de Pronto (Definition of Done) *(obrigatório)*

- [x] Todos os cenários de aceitação (1–13) desta spec passam ponta a ponta via testes
      de integração (`app.inject()` + `mongodb-memory-server`, sem mock de banco).
      Verificado em `tests/integration/http/feed.routes.spec.ts` e nos specs de
      `tests/integration/services/{feed,reading-sessions,reviews}/**` — 404 testes
      verdes no total (`pnpm test`) — **e** manualmente contra um servidor real
      (`node dist/server.js`) + MongoDB real (`mongodb-memory-server` standalone, já
      que o `.env` do projeto aponta pro cluster Atlas compartilhado `development` e
      Docker não estava disponível no ambiente) + stub HTTP local do Open Library,
      cobrindo as 3 contas, follow aprovado, os 4 tipos de evento, edição/exclusão
      refletindo no feed, cascade completo, privacidade e paginação.
- [x] Cobertura de teste automatizado em `src/services/**` ≥ 70%. `pnpm test:coverage`
      confirma (execução sem falha de threshold) — `src/services/feed/**` em 100%
      linhas/statements.
- [x] Teste explícito comprovando a privacidade (P6): atividade de quem não é seguido
      com follow aprovado nunca aparece no feed do espectador, e que a própria atividade
      do usuário sempre aparece no próprio feed (cenários 2, 3, 12, 13). Verificado em
      `get-feed.service.spec.ts` e `feed.routes.spec.ts`.
- [x] Teste cobrindo paginação por cursor sem duplicar nem pular itens, mesmo com novos
      eventos inseridos entre páginas consecutivas (cenário 11). Verificado no nível de
      repositório (`mongo-activity.repository.spec.ts`), de service e de rota HTTP.

---

## Esclarecimentos

*Preenchido pelo comando `/clarify`. Cada rodada adiciona uma subseção com data.*

### Sessão 2026-09-04

- P: Quando uma review/reading session é editada ou apagada, o feed deve refletir a
  mudança? → R: sim — o feed nunca guarda cópia do conteúdo, sempre resolve para o
  estado atual da entidade de origem; apagar a entidade remove o evento do feed.
- P: Todo progress update vira item de feed, ou só marcos? → R: todo update de
  progresso vira um evento de feed.
- P: O feed deve suportar filtro por tipo de evento ou por pessoa no MVP? → R: não —
  endpoint único, cronológico, sem filtro (fica pro roadmap).
- P: Quando um progress update cria a reading session implicitamente (P10, sem start
  explícito antes), o feed emite os dois eventos (começou a ler + progress update) ou só
  o progress update? → R: só o evento de progress update.
- P: O feed deve incluir a própria atividade do usuário autenticado, ou só de quem ele
  segue? → R: inclui a própria atividade, misturada cronologicamente com a de quem ele
  segue (feed pessoal + social combinado).

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
- [x] Dependências e premissas identificadas (003 reading sessions, 004 follow, 005
      reviews)
- [x] Definição de Pronto preenchida, com critérios objetivos e verificáveis
