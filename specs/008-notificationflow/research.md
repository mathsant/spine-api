# Fase 0 — Pesquisa: Fluxo de notificações

Feature: `008-notificationflow` · Data: 2026-09-05

Nenhum item do Contexto Técnico ficou como `[NEEDS CLARIFICATION]` — a stack já está travada em
`architecture.md` (reaproveitada sem alteração, nenhuma dependência nova). Esta fase registra
decisões de design que iam além do que a spec cobria explicitamente, e como as respostas dadas no
`/specify` (seção "Esclarecimentos" do `spec.md`) se traduzem em mecanismo concreto.

## D1 — Notificação só é criada quando o evento é genuinamente novo, nunca a cada chamada idempotente

**Decisão**: os dois pontos de origem que já são idempotentes na sua própria feature continuam
idempotentes também para notificação:
- `follow_request`: `send-follow-request.service.ts` já retorna `created: boolean` (existente
  desde a 004 — `false` quando o pedido já estava pendente). A notificação só é criada quando
  `created === true`.
- `reaction_on_content`: `ReactionRepository.add` (007) hoje devolve `Promise<void>`, então
  `create-reaction.service.ts` não tem como saber se a curtida já existia. `add` passa a devolver
  `Promise<boolean>` (`true` = inseriu agora), usando `result.upsertedCount > 0` que o próprio
  `updateOne` já calcula — nenhuma consulta extra. A notificação só é criada quando o retorno é
  `true`.

Comentário (`comment_on_content`/`comment_reply`) não tem esse problema: `create-comment` nunca é
idempotente — toda chamada bem-sucedida é um comentário novo, logo sempre gera notificação (ou
duas, ver D3).

**Justificativa**: a spec fixou "uma notificação por evento" (sem agregação, esclarecimento do
`/specify`). Re-enviar um pedido de follow já pendente, ou curtir um item já curtido, não é um
evento novo — são as mesmas ações idempotentes que RF-002/RF-008 de 004/007 já garantem não
duplicar o registro de origem; duplicar a notificação nesses casos criaria ruído inconsistente com
"idempotente" no restante da API.

**Alternativas consideradas**: notificar sempre que o service é chamado, independente de
`created`/upsert — rejeitado, um duplo-clique no botão de curtir ou reenviar o mesmo pedido geraria
spam de notificação idêntica. Checar existência antes do `add`/`create` com uma consulta separada —
rejeitado, reintroduz uma condição de corrida (TOCTOU) que o upsert/idempotência da 004/007 já
elimina; usar o resultado que o próprio `updateOne` devolve é grátis.

## D2 — Remoção por chave (recipiente/ator/tipo[/activityId]), sem guardar um id de origem solto

**Decisão**: `follow_request` e `reaction_on_content` são removidos por chave composta, a mesma que
já identifica a entidade de origem de forma única:
- `follow_request`: chave `(recipientId, actorId, type: 'follow_request')` — único por par, porque
  `FollowRequestRepository` já garante no máximo um pedido pendente por par requester/target.
  `NotificationRepository.deleteFollowRequestNotification(recipientId, actorId)` remove por essa
  chave, chamado tanto de `approve-follow-request` quanto de `reject-follow-request`.
- `reaction_on_content`: chave `(recipientId, actorId, type: 'reaction_on_content', activityId)` —
  precisa do `activityId` porque o mesmo `actorId` pode ter curtido vários itens diferentes do
  mesmo `recipientId` (dono), e só a curtida de um item específico está sendo desfeita.
  `NotificationRepository.deleteReactionNotification(activityId, actorId)` (o `recipientId` é
  resolvido a partir do `activityId` no momento da criação, não precisa ser passado de novo aqui —
  ver D5/`data-model.md` para o índice usado).

**Justificativa**: evita um campo extra (`sourceId`/`followRequestId`/`reactionId`) só para permitir
a remoção — a própria chave que a entidade de origem já usa para garantir unicidade (par
requester/target; par activityId/userId) é suficiente e já está indexada por outro motivo em cada
repositório de origem. Menos um campo no schema, sem perda de precisão.

**Alternativas consideradas**: guardar o id do documento de origem (`followRequestId`/`reactionId`)
na notificação e deletar por esse id — rejeitado, exige propagar um id que o chamador (`approve-`/
`reject-follow-request`, `delete-reaction`) já não tem à mão sem uma consulta a mais (o
`deleteByPair`/`remove` de origem não devolvem o id do documento apagado hoje), enquanto a chave
composta já está disponível nos parâmetros que esses services já recebem.

## D3 — Dedup de `comment_reply` vs `comment_on_content` decidida no `create-comment.service`

**Decisão**: a regra do `/specify` ("quando o dono do post é o mesmo autor do comentário-pai,
gerar só 1 notificação — a de resposta") é resolvida dentro de `create-comment.service.ts`, não no
repositório nem no helper genérico `createNotification`:

```
sempre que houver parentCommentId:
  notifica comment_reply para parent.authorId
  se parent.authorId === activity.actorId (dono do item): NÃO notifica comment_on_content
sempre que NÃO houver dedup acima: notifica comment_on_content para activity.actorId
```

**Justificativa**: os dois ids que decidem a dedup (`activity.actorId`, o dono do item, e
`parent.authorId`, o autor do comentário-pai) só existem juntos no momento em que
`create-comment.service` já resolveu ambos (via `resolveVisibleActivity` e
`commentRepository.findById(parentCommentId)`, ambos já necessários por RF-005/RF-006/RF-010 de
007). Mover essa comparação para o repositório ou para um helper mais genérico exigiria repassar os
dois ids mesmo assim, sem ganho — e misturaria uma regra de negócio específica de comentário dentro
de um helper que outros domínios (follow, reação) também usam.

**Alternativas consideradas**: sempre gerar as duas notificações e deixar o cliente deduplicar na
exibição — rejeitado, contraria a decisão do `/specify` de "1 notificação só" (a API é quem decide
o quê persistir, não o cliente).

## D4 — "Nunca notificar o próprio ator" é responsabilidade do helper genérico, não de cada chamador

**Decisão**: `createNotification` (o único ponto de escrita de `NotificationRepository.create`)
recusa-se (`no-op`, sem erro) sempre que `input.recipientId === input.actorId`. Nenhum dos 4 pontos
de chamada (`send-follow-request`, `approve-follow-request`, `create-comment`, `create-reaction`)
replica essa checagem.

**Justificativa**: RF-009 (sem auto-notificação) vale para todo tipo de evento igualmente — é uma
regra transversal, não específica de um domínio. Centralizá-la no único helper que efetivamente
grava o documento garante que nenhum ponto de chamada futuro esqueça de checar, e que
`create-comment.service.ts` (que já tem uma lógica de dedup própria, D3) não precise também
replicar essa outra regra — ele só monta os `CreateNotificationInput` e deixa o helper decidir se
grava.

**Alternativas consideradas**: checar `recipientId !== actorId` em cada service antes de chamar
`createNotification` — rejeitado, 4 cópias da mesma condição, mesmo raciocínio de D1/D2 de 007
sobre não duplicar regra de negócio idêntica em múltiplos pontos.

## D5 — Cascade de `Notification` via denormalização, mesmo padrão de `Comment`/`Reaction` (007, D3)

**Decisão**: `Notification` guarda, além de `activityId`/`commentId` (nullable conforme o tipo),
os campos denormalizados `readingSessionId` e `activityType` (nullable, só preenchidos nos 3 tipos
ligados a uma `Activity`: `comment_on_content`, `comment_reply`, `reaction_on_content`) — copiados
do `ActivityRecord` já resolvido no momento da criação. Isso habilita
`deleteByReadingSessionId(readingSessionId)` / `deleteByReadingSessionIdAndType(readingSessionId,
activityType)`, espelhando exatamente os métodos que `Comment`/`Reaction` já expõem para o mesmo
propósito (cascade de `delete-reading-session`/`delete-review`).

**Justificativa**: é o mesmo raciocínio de 007/D3 — evita alterar a assinatura de
`ActivityRepository`, `CommentRepository` ou `ReactionRepository` outra vez só para servir um
consumidor novo (`NotificationRepository`). `delete-reading-session.service.ts` e
`delete-review.service.ts` já chamam `commentRepository.deleteByReadingSessionId(...)` e
`reactionRepository.deleteByReadingSessionId(...)` lado a lado — adicionar
`notificationRepository.deleteByReadingSessionId(...)` no mesmo ponto segue o padrão já
estabelecido sem introduzir um mecanismo novo.

**Alternativas consideradas**: nenhuma nova — mesma decisão de 007/D3, aplicada ao domínio novo.

## D6 — Remoção da notificação de comentário/curtida é por `commentId`/chave de reação, não por cascade genérico de "conteúdo apagado"

**Decisão**: `delete-comment.service.ts` chama `notificationRepository.deleteByCommentId(commentId)`
depois do soft delete; `delete-reaction.service.ts` chama
`notificationRepository.deleteReactionNotification(activityId, userId)` depois de confirmar a
remoção. Um único comentário pode ter gerado até 2 notificações (`comment_on_content` +
`comment_reply`, D3) — `deleteByCommentId` remove ambas numa query, pois as duas guardam o mesmo
`commentId`.

**Justificativa**: RF-010 pede remoção quando "o comentário/curtida que a originou é apagado" —
isso é uma ação pontual sobre uma entidade específica (um `commentId`, um par
`activityId`+`userId`), não um cascade em lote como o de `delete-reading-session`/`delete-review`
(D5). Manter os dois mecanismos separados (delete pontual vs. cascade em lote por sessão) evita
confundir "apagar 1 comentário" com "apagar todos os comentários de uma sessão".

**Alternativas consideradas**: nenhuma — segue diretamente o esclarecimento do `/specify` ("remove/
invalida a notificação correspondente" quando a origem específica é apagada).

## D7 — DTO plano, sem bloco `viewer`/expansão de ator, mesma convenção de `CommentDTO` (007, D8)

**Decisão**: `NotificationDTO` expõe `actorId`, `activityId`, `commentId` como referências simples
(strings/`null`), sem embutir o perfil do ator nem o conteúdo do item/comentário relacionado.

**Justificativa**: mesma convenção que `CommentDTO` (007) e `FollowRequestCreationDTO` (004) já
seguem — o cliente resolve o ator via os endpoints de perfil/busca já existentes. RF-017 pede "dado
suficiente para identificar o tipo de evento, quem o originou e o conteúdo relacionado" — os 3 ids
mais o `type` já bastam para o cliente montar a mensagem ("fulano comentou no seu post") e navegar
até o conteúdo; embutir dados de outro domínio infringiria a mesma preocupação de escopo que levou
007/D8 a não introduzir um bloco `viewer` ainda.

**Alternativas consideradas**: embutir `actorDisplayName`/`actorHandle` diretamente no DTO —
rejeitado, é a primeira vez que um DTO desnormalizaria dado de `User` para exibição; decisão de
convenção maior que o escopo desta feature (mesma lógica de 007/D8).

## D8 — Rotas de ação fora de `/me/`, listagem/contagem dentro de `/me/`

**Decisão**: `GET /v1/me/notifications` e `GET /v1/me/notifications/unread-count` (leitura, sempre
relativa ao usuário autenticado, mesmo padrão de `GET /v1/me/follow-requests`); já
`POST /v1/notifications/:notificationId/read` e `POST /v1/notifications/read-all` (ação sobre
recurso próprio, ownership resolvida no service, mesmo padrão de `DELETE /v1/comments/:commentId`
que também não usa prefixo `/me/`).

**Justificativa**: reaproveita os dois padrões de rota que o projeto já usa lado a lado para o
mesmo tipo de distinção (listagem do próprio usuário vs. ação sobre um recurso identificado por id
próprio) em vez de inventar um terceiro estilo.

**Alternativas consideradas**: `POST /v1/me/notifications/:notificationId/read` (tudo sob `/me/`) —
rejeitado, nenhuma outra rota de ação do projeto (aprovar/recusar follow request, apagar comentário)
usa `/me/` quando o id do recurso já implica posse; manter o padrão existente evita uma
inconsistência nova.
