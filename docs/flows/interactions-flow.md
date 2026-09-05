# Fluxo: comentários e curtidas

Interações acontecem sempre em cima de um item de feed (`activityId` — o mesmo `id` que aparece em `FeedItem`, ver `feed-flow.md`), nunca diretamente num livro ou review "solto".

## Comentar

1. `POST /activities/{activityId}/comments` (`createComment`) com `text` e, opcionalmente, `parentCommentId` para responder a outro comentário do **mesmo** item.
2. `GET /activities/{activityId}/comments` (`listComments`), paginado por cursor, ordem cronológica **ascendente** (mais antigo primeiro — diferente do feed, que é decrescente).
3. `DELETE /comments/{commentId}` (`deleteComment`) — **soft delete**: o comentário não some da lista, `deleted` vira `true` e `text` passa a ser o literal `"[removido]"` (o texto original nunca é devolvido de novo).

### Regras de negócio não óbvias

- **Aninhamento de no máximo 1 nível** — `parentCommentId` deve apontar para um comentário de nível 1 (top-level). Responder a uma resposta é rejeitado com `422 COMMENT_NESTING_TOO_DEEP`.
- **Só pode apagar o próprio comentário** — apagar um de outra pessoa responde o mesmo 404 de "não existe" (`COMMENT_NOT_FOUND`), nunca `403`.

## Curtir

1. `POST /activities/{activityId}/reactions` (`createReaction`) — idempotente: curtir de novo algo que já curti responde `204` sem duplicar.
2. `DELETE /activities/{activityId}/reactions` (`deleteReaction`) — remove a curtida do usuário autenticado.

Não existe "listar quem curtiu" nesta API hoje — o feed só expõe `reactionsCount` (total) e `hasReacted` (se o próprio espectador curtiu), ver `viewer-block.md`.

## Regra comum aos dois: itens fora de escopo

`started_reading` é o único tipo de item de feed que **não aceita** comentário nem curtida — qualquer tentativa (criar comentário, listar comentários, curtir, descurtir) responde `422 UNSUPPORTED_ACTIVITY_INTERACTION`. Os demais tipos (`finished_reading`, `review_published`, `progress_update`) aceitam os dois.

## Visibilidade

Um `activityId` que não existe, **ou** que existe mas o usuário autenticado não é o dono nem segue aprovado o dono, responde exatamente o mesmo `404 ACTIVITY_NOT_FOUND` nos dois casos — perfil privado por padrão (P6) também vale para interações: não dá para descobrir que um item "privado" existe tentando comentar nele.

## Erros específicos deste fluxo

`ACTIVITY_NOT_FOUND`, `UNSUPPORTED_ACTIVITY_INTERACTION`, `COMMENT_NOT_FOUND`, `COMMENT_NESTING_TOO_DEEP`, `REACTION_NOT_FOUND` — detalhes em `error-catalog.md`.
