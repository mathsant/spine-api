# Especificação de Feature: Fluxo de notificações

**Branch**: `008-notificationflow`
**Criado em**: 2026-09-05
**Status**: Rascunho
**Entrada**: descrição original do usuário: "notification-flow - nessa spec vamos implementar toda a parte de notificacao definida para o projeto." Ver `product.md` item 9 do escopo MVP ("Notificações: follow request, follow aprovado, comentário/curtida no seu conteúdo; listar e marcar como lida (polling)") e o glossário de `Notification`.

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

Uma pessoa quer saber, sem precisar ficar checando manualmente, quando algo relevante acontece
envolvendo ela: alguém pediu para segui-la, seu pedido de follow foi aprovado, alguém comentou ou
curtiu um item seu no feed, ou alguém respondeu a um comentário seu. Ela consulta sua lista de
notificações (por polling, no MVP), vê as mais recentes primeiro, sabe quantas ainda não leu, e
pode marcar uma notificação específica — ou todas de uma vez — como lida. Notificações não geram
ruído para ações que ela mesma fez no próprio conteúdo, e desaparecem quando deixam de fazer
sentido (pedido de follow já resolvido, comentário ou curtida que as originou foi apagado).

### Cenários de aceitação

1. **Dado** que B envia um follow request para A, **quando** o pedido é criado, **então** A recebe
   uma notificação do tipo `follow_request` não lida, referenciando B como autor do evento.
2. **Dado** o follow request de B para A pendente (cenário 1), **quando** A aprova o pedido,
   **então** a notificação `follow_request` de A é removida da lista dele, e B recebe uma nova
   notificação do tipo `follow_approved` não lida.
3. **Dado** o follow request de B para A pendente, **quando** A recusa o pedido, **então** a
   notificação `follow_request` de A é removida da lista dele e B **não** recebe nenhuma
   notificação sobre a recusa.
4. **Dado** que B é seguidor aprovado de A, **quando** B comenta (nível 1) num item de feed de A,
   **então** A recebe uma notificação do tipo `comment_on_content` referenciando o item e o
   comentário.
5. **Dado** a notificação do cenário 4, **quando** B apaga o comentário que a originou, **então**
   essa notificação é removida/invalidada da lista de A.
6. **Dado** um comentário de nível 1 de B num item de A, **quando** um terceiro usuário C (também
   seguidor aprovado de A) responde a esse comentário, **então** B recebe uma notificação do tipo
   `comment_reply` (responderam ao seu comentário) **e**, separadamente, A recebe uma notificação
   `comment_on_content` (novo comentário no seu item) — duas notificações, dois destinatários
   diferentes.
7. **Dado** que o comentário de nível 1 respondido no cenário 6 pertence ao próprio A (dono do
   item), **quando** C responde a esse comentário, **então** A recebe **apenas uma** notificação
   (a de `comment_reply`, mais específica) — não recebe também uma `comment_on_content` duplicada
   para o mesmo evento.
8. **Dado** que B é seguidor aprovado de A, **quando** B reage (curte) um item de feed de A,
   **então** A recebe uma notificação do tipo `reaction_on_content`.
9. **Dado** a notificação do cenário 8, **quando** B remove a curtida, **então** essa notificação
   é removida/invalidada da lista de A.
10. **Dado** que A comenta, responde ou curte um item, comentário ou pedido que é do próprio A,
    **quando** essa ação ocorre, **então** nenhuma notificação é criada para A sobre a própria ação.
11. **Dado** que A tem várias notificações, algumas lidas e outras não, **quando** A lista suas
    notificações, **então** a listagem vem paginada por cursor, ordenada da mais recente para a
    mais antiga, e A só vê as próprias notificações (nunca as de outro usuário).
12. **Dado** uma notificação não lida de A, **quando** A marca essa notificação específica como
    lida, **então** ela passa a ter `readAt` preenchido e o contador de não lidas de A diminui em 1.
13. **Dado** que A tem N notificações não lidas, **quando** A chama a ação de marcar todas como
    lidas, **então** todas as N passam a ter `readAt` preenchido e o contador de não lidas de A
    vai a zero.
14. **Dado** que A já marcou uma notificação como lida, **quando** A tenta marcá-la como lida de
    novo, **então** a operação é idempotente (não falha, não duplica efeito, `readAt` original é
    preservado).
15. **Dado** um usuário autenticado, **quando** ele consulta o contador de notificações não lidas,
    **então** o valor retornado reflete corretamente o estado atual (após qualquer dedupe,
    remoção em cascata por conteúdo apagado, ou resolução de follow request).

### Casos de borda

- B envia um follow request, A recusa, e depois B envia um novo pedido: cada pedido novo gera sua
  própria notificação `follow_request`; a notificação do pedido anterior (já recusado) não existe
  mais.
- O item de feed, review ou reading session que originou uma notificação é apagado pelo próprio
  dono (não pelo autor do comentário/curtida): as notificações associadas àquele conteúdo também
  deixam de existir, pelo mesmo princípio de remoção em cascata do cenário 5/9.
- Uma pessoa comenta e também curte o mesmo item: são dois eventos independentes, geram duas
  notificações separadas (não se fundem em uma só).
- Um follow request pendente nunca é respondido: a notificação continua não lida indefinidamente,
  sem expiração automática no MVP.
- Reação só existe em itens de feed, nunca em comentários (regra já fixada no projeto) — logo não
  há notificação de "curtiram seu comentário".
- Quem não é seguidor aprovado do dono do item nunca consegue comentar ou curtir (regra de
  visibilidade já garantida por outra feature) — portanto nunca é fonte de notificação indevida.

## Requisitos *(obrigatório)*

### Requisitos funcionais

- **RF-001**: O sistema DEVE criar uma notificação `follow_request` para o usuário-alvo quando
  outro usuário envia um follow request para ele.
- **RF-002**: O sistema DEVE criar uma notificação `follow_approved` para o solicitante quando seu
  follow request é aprovado.
- **RF-003**: O sistema NÃO DEVE criar nenhuma notificação para o solicitante quando seu follow
  request é recusado.
- **RF-004**: O sistema DEVE remover a notificação `follow_request` pendente assim que o pedido
  correspondente for aprovado ou recusado.
- **RF-005**: O sistema DEVE criar uma notificação `comment_on_content` para o dono de um item de
  feed sempre que outro usuário comenta nesse item, seja o comentário de nível 1 ou uma resposta.
- **RF-006**: O sistema DEVE criar uma notificação `comment_reply` para o autor de um comentário de
  nível 1 sempre que outro usuário responde a esse comentário.
- **RF-007**: Quando o dono do item de feed é a mesma pessoa que o autor do comentário-pai
  respondido, o sistema DEVE gerar apenas a notificação `comment_reply` para essa pessoa — não
  DEVE gerar também a `comment_on_content` duplicada para o mesmo evento.
- **RF-008**: O sistema DEVE criar uma notificação `reaction_on_content` para o dono de um item de
  feed sempre que outro usuário reage (curte) esse item.
- **RF-009**: O sistema NÃO DEVE criar notificação quando o autor da ação (comentar, responder,
  curtir) é o próprio dono do conteúdo afetado (sem auto-notificação).
- **RF-010**: O sistema DEVE remover/invalidar a notificação correspondente quando o comentário ou
  a curtida que a originou é apagado ou removido, incluindo quando a remoção é em cascata (ex.: o
  item/review/reading session de origem é apagado).
- **RF-011**: O sistema DEVE permitir que um usuário autenticado liste suas próprias notificações,
  paginadas por cursor, ordenadas da mais recente para a mais antiga.
- **RF-012**: O sistema DEVE garantir que um usuário só veja e só possa agir (marcar como lida)
  sobre as próprias notificações, nunca as de outro usuário.
- **RF-013**: O sistema DEVE permitir que um usuário marque uma notificação específica sua como
  lida.
- **RF-014**: O sistema DEVE permitir que um usuário marque todas as suas notificações não lidas
  como lidas de uma só vez.
- **RF-015**: Marcar como lida (individual ou em massa) DEVE ser idempotente — repetir a ação não
  falha, não duplica efeito, e não altera o `readAt` de uma notificação já lida.
- **RF-016**: O sistema DEVE expor a contagem de notificações não lidas do usuário autenticado.
- **RF-017**: Cada notificação DEVE conter dado suficiente para o cliente identificar o tipo de
  evento, quem o originou (ator) e o conteúdo relacionado, sem exigir chamadas adicionais para
  montar a mensagem básica de exibição.

### Entidades-chave

- **Notification**: registro persistido de um evento relevante para um usuário. Atributos-chave:
  destinatário (`recipient`, o usuário dono da notificação), tipo (`follow_request` |
  `follow_approved` | `comment_on_content` | `comment_reply` | `reaction_on_content`), ator (quem
  originou o evento), referência à origem (o item de feed, comentário, curtida ou follow request
  que gerou a notificação — usada tanto para exibição quanto para a remoção em cascata), data de
  criação, e data de leitura (vazia até ser marcada como lida). Relaciona-se com `User` (destinatário
  e ator), `Activity`, `Comment`, `Reaction` e `Follow request`, conforme o tipo.

---

## Definição de Pronto (Definition of Done) *(obrigatório)*

- [x] Todos os cenários de aceitação acima passam com teste automatizado.
- [x] Marcar como lida — individual e em massa ("marcar todas") — implementado e coberto por
      teste, incluindo o caso idempotente (RF-015).
- [x] O contador de notificações não lidas está correto em todos os pontos de checagem: após
      criação, após leitura (individual e em massa), após remoção em cascata (comentário/curtida
      apagados, conteúdo de origem apagado) e após resolução de follow request.
- [x] Nenhuma regressão nos fluxos existentes de follow (004), review (005), comentário e curtida
      (007) — as alterações necessárias para disparar notificação não mudam o comportamento já
      testado dessas features.

---

## Esclarecimentos

*Preenchido pelo comando `/clarify`. Cada rodada adiciona uma subseção com data.*

### Sessão 2026-09-05

- P: Resposta a um comentário seu (aninhado, quando você não é o dono do post) deve gerar
  notificação para você? → R: Sim, notifica o autor do comentário pai (além do dono do post ser
  notificado do novo comentário).
- P: Quando um follow request é recusado, o solicitante deve receber notificação da recusa? →
  R: Não, a recusa fica silenciosa.
- P: Notificações de curtida/comentário devem ser agregadas (ex.: "3 pessoas curtiram") ou uma
  notificação por evento? → R: Uma notificação por evento.
- P: Se o comentário/curtida que originou uma notificação for apagado depois, o que acontece com
  a notificação já criada? → R: É removida/invalidada.
- P: Quando um follow request pendente é aprovado ou recusado, a notificação original some da
  lista ou continua como histórico? → R: Some da lista assim que a decisão é tomada.
- P: Marcar como lida — só individual, ou também "marcar todas de uma vez"? → R: Ambos.
- P: Precisa de endpoint/contador de não lidas? → R: Sim.
- P: Quando o dono do post também é o autor do comentário-pai respondido, ele recebe 2
  notificações (uma de cada tipo) ou 1 deduplicada? → R: 1 notificação só, a mais específica
  (`comment_reply`).

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
