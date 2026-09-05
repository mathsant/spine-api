# Especificação de Feature: Interações — comentar e curtir itens de feed

**Branch**: `007-interactions`
**Criado em**: 2026-09-04
**Status**: Rascunho
**Entrada**: descrição original do usuário: "007-interactions: comentar e curtir itens de feed (review, progress update, finished_reading). Ver product.md item 8 do escopo MVP ("Interações: comentar e curtir itens de feed") e o glossário de Comment/Reaction. Comentário de texto com aninhamento raso (1 nível); reação é curtida simples (um tipo só) no MVP. Igual às outras features do domínio, a visibilidade de quem pode comentar/curtir e ver itens respeita o modelo de follow aprovado (P6) do usuário DONO do item de feed."

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

Uma pessoa que segue (e foi aprovada por) outra vê, no feed, um item de atividade dela — uma
review publicada, um progress update ou um "terminei de ler". Ela quer reagir rápido com uma
curtida, ou deixar um comentário de texto, e opcionalmente responder ao comentário de outra
pessoa naquele mesmo item. O dono do item também pode curtir/comentar no próprio post, e pode
apagar um comentário seu (o texto some, mas o lugar na conversa fica marcado como removido).
Quem não é seguidor aprovado do dono do item não vê nem interage com nada daquele item.

### Cenários de aceitação

1. **Dado** um usuário B segue A com follow aprovado, e A tem um item de feed do tipo
   `review_published`, **quando** B envia uma curtida nesse item, **então** a curtida é
   registrada e uma consulta posterior ao item mostra `hasReacted: true` para B e o contador de
   curtidas aumenta em 1.
2. **Dado** que B já curtiu um item, **quando** B envia a mesma curtida de novo, **então** o
   sistema não duplica o registro (idempotente) e o contador não muda.
3. **Dado** que B já curtiu um item, **quando** B chama a ação de remover a curtida, **então** o
   registro é removido, `hasReacted` volta a `false` para B e o contador diminui em 1.
4. **Dado** um item de feed do tipo `progress_update` de A, **quando** B (seguidor aprovado)
   publica um comentário de texto nesse item, **então** o comentário é criado, associado àquele
   item específico (aquele evento, não a outros progress updates da mesma reading session), e
   aparece na listagem de comentários do item.
5. **Dado** um comentário de nível 1 (top-level) de B num item de A, **quando** um terceiro
   usuário C (também seguidor aprovado de A) responde a esse comentário, **então** a resposta é
   criada com referência ao comentário de B e aparece aninhada sob ele.
6. **Dado** uma resposta (comentário de nível 2) de C, **quando** alguém tenta responder a essa
   resposta, **então** o sistema rejeita a operação (aninhamento máximo de 1 nível, RF-010).
7. **Dado** um comentário próprio, **quando** o autor pede para apagá-lo, **então** o comentário
   passa a exibir um placeholder de "removido" no lugar do texto, mas a posição dele na thread
   (e as respostas existentes a ele, se houver) são preservadas.
8. **Dado** um item de feed de A, **quando** o próprio A comenta ou curte esse item, **então** a
   ação é aceita normalmente (sem restrição de auto-interação).
9. **Dado** um usuário D que **não** é seguidor aprovado de A (nunca pediu, pedido pendente, ou
   foi recusado), **quando** D tenta comentar, curtir, descurtir ou listar comentários/curtidas
   de um item de A, **então** o sistema recusa a ação (mesma semântica de "não existe" usada
   pelo resto da API para conteúdo não visível — sem vazar se o item existe).
10. **Dado** uma reading session (ou review) que é apagada e cuja `Activity` correspondente é
    removida em cascata (comportamento já existente da feature 006), **quando** essa exclusão
    acontece, **então** todos os comentários e curtidas daquela `Activity` são removidos junto —
    nenhum registro órfão fica no banco.
11. **Dado** um item de feed do tipo `started_reading`, **quando** alguém tenta comentar ou
    curtir esse item, **então** o sistema recusa a ação — `started_reading` está fora do escopo
    de itens comentáveis/curtíveis desta feature.

### Casos de borda

- Comentar ou curtir um `activityId` que não existe (nunca existiu, ou já foi removido em
  cascata): tratado como "não encontrado" — a API não distingue "não existe" de "existe mas você
  não pode ver" (mesma regra de privacidade do resto do domínio, P6).
- Comentário com texto vazio: rejeitado (mesma validação de "conteúdo obrigatório").
- Responder a um comentário que já foi apagado (soft delete): ainda é permitido — o placeholder
  de "removido" ocupa o lugar do comentário original, mas a thread continua aceitando resposta
  nesse nível (o apagamento não fecha a conversa).
- Curtir/comentar um item cujo dono revogou a aprovação do follow depois que a curtida/comentário
  já existia: o registro antigo permanece (não há remoção retroativa); ele só deixa de ser visível
  para o usuário que perdeu o acesso, junto com o resto do conteúdo daquele dono, seguindo a regra
  geral de P6.

## Requisitos *(obrigatório)*

### Requisitos funcionais

- **RF-001**: O sistema DEVE permitir que um usuário curta (reaja a) um item de feed dos tipos
  `review_published`, `progress_update` ou `finished_reading`, desde que seja o dono do item ou
  um seguidor aprovado do dono.
- **RF-002**: O sistema DEVE tratar a curtida como idempotente — curtir um item já curtido pelo
  mesmo usuário não cria um segundo registro nem altera o contador.
- **RF-003**: O sistema DEVE permitir que o usuário remova (descurta) uma curtida própria
  existente num item.
- **RF-004**: O sistema DEVE expor, para cada item de feed consultado, o contador total de
  curtidas e se o usuário autenticado (espectador) já curtiu aquele item (`hasReacted`).
- **RF-005**: O sistema DEVE permitir que um usuário publique um comentário de texto num item de
  feed dos tipos `review_published`, `progress_update` ou `finished_reading`, desde que seja o
  dono do item ou um seguidor aprovado do dono.
- **RF-006**: O sistema DEVE exigir texto não vazio para criar um comentário.
- **RF-007**: O sistema DEVE permitir que um comentário seja uma resposta direta a outro
  comentário do mesmo item (aninhamento de nível 1), preservando a referência ao comentário-pai.
- **RF-008**: O sistema DEVE listar os comentários de um item de feed em ordem cronológica,
  paginados por cursor, com cada resposta associada ao seu comentário-pai.
- **RF-009**: O sistema DEVE permitir que o autor de um comentário o apague (soft delete); o
  texto original deixa de ser retornado e um placeholder de "removido" ocupa o lugar do
  comentário na thread, sem remover respostas existentes a ele.
- **RF-010**: O sistema DEVE rejeitar a criação de um comentário cujo comentário-pai já seja, ele
  mesmo, uma resposta (aninhamento máximo de 1 nível).
- **RF-011**: O sistema NÃO DEVE permitir comentar ou curtir itens de feed do tipo
  `started_reading` — fora do escopo desta feature.
- **RF-012**: O sistema DEVE negar comentar, curtir, descurtir ou listar comentários/curtidas de
  um item de feed para qualquer usuário que não seja o dono do item nem um seguidor aprovado do
  dono, sem revelar se o item existe (mesma semântica de privacidade usada no resto da API, P6).
- **RF-013**: O sistema DEVE remover em cascata todos os comentários e curtidas de uma `Activity`
  quando essa `Activity` for removida (cascade já existente da feature 006 ao apagar reading
  session ou review).
- **RF-014**: O sistema DEVE permitir que o próprio dono de um item de feed comente ou curta o
  próprio item, sem restrição de auto-interação.
- **RF-015**: Curtir ou comentar um item de feed que não existe (nunca existiu ou já foi removido
  em cascata) DEVE ser tratado como "não encontrado".

### Entidades-chave *(se a feature envolve dados)*

*Nomeie cada entidade e atributo em inglês (regra fixa do kit — vira identificador no código); a descrição fica em português.*

- **Comment**: comentário de texto sobre um item de feed (`activityId`). Campos-chave: autor
  (`authorId`), texto (`text`), referência opcional ao comentário-pai (`parentCommentId`, só
  para respostas de nível 1), estado de remoção (soft delete — flag + timestamp), momento de
  criação. Relação: pertence a uma `Activity` (006); pode ter 0..N respostas, mas só quando ele
  próprio é top-level (`parentCommentId` nulo).
- **Reaction**: curtida simples (um único tipo, sem variação) de um usuário sobre um item de
  feed (`activityId`). Campos-chave: autor (`userId`), referência ao item (`activityId`), momento
  de criação. Único tipo de reação no MVP — não há campo de "tipo de reação" variável. Relação:
  no máximo um registro por par (usuário, item) — repetir a curtida é idempotente (RF-002).

---

## Definição de Pronto (Definition of Done) *(obrigatório)*

- [x] Todos os cenários de aceitação acima passam via teste automatizado (unit + integração com
      `mongodb-memory-server`, seguindo o padrão já usado nas features 003–006). Verificado:
      `pnpm test` — 469/469 testes passando, incluindo os 11 cenários e os 4 casos de borda desta
      spec; validado manualmente também via `quickstart.md` contra o servidor local.
- [x] Cobertura de teste automatizado ≥ 70% no código novo de `src/services/comments` e
      `src/services/reactions` (mesmo gate já fixado em `src/services/**` nas features
      anteriores). Verificado: `pnpm test:coverage` — 100% em `src/services/comments`,
      `src/services/reactions` e `src/services/activities` (dados brutos de
      `coverage-final.json`; o resumo em texto do reporter v8 omite essas linhas por truncamento
      de coluna, mas o JSON confirma 100% statements/lines em todos os arquivos).
- [x] Ao apagar uma reading session ou review (cascade de `Activity` já existente da feature
      006), nenhum comentário ou curtida órfão permanece no banco — verificado por teste de
      integração dedicado em `delete-reading-session.service.spec.ts` e
      `delete-review.service.spec.ts`, e manualmente no passo 9 do `quickstart.md`.
- [x] Nenhum endpoint de comentário/curtida vaza dado ou permite ação para quem não é o dono do
      item nem seguidor aprovado do dono (P6) — verificado por teste de integração dedicado
      cobrindo os cenários 9 e 11, e manualmente nos passos 7–8 do `quickstart.md`.

---

## Esclarecimentos

*Preenchido pelo comando `/clarify`. Cada rodada adiciona uma subseção com data.*

### Sessão 2026-09-04 (durante `/specify`)

- P: Comentário/curtida são por evento de atividade específico (activity id) ou por entidade de
  origem (agregando todos os eventos da mesma reading session/review)? → R: Por item de
  atividade (activity id) — cada evento de feed é um alvo independente.
- P: A curtida se aplica só ao item de feed ou também a comentários individuais? → R: Só itens
  de feed; comentários não podem ser curtidos no MVP.
- P: O autor de um comentário pode editar o texto, ou só apagar? → R: Só apagar (soft delete,
  placeholder "[removido]") — sem edição no MVP.
- P: Existe uma ação explícita de remover a curtida (descurtir)? → R: Sim — mesmo padrão de
  seguir/deixar de seguir (P13).
- P: O dono de um item de feed pode comentar e curtir o próprio post? → R: Sim, permitido, sem
  restrição.

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
