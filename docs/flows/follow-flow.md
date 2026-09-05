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

## Regras de negócio não óbvias

- **Não dá para seguir a si mesmo** — `422 CANNOT_FOLLOW_SELF`.
- **Não dá para pedir de novo se já sigo** — `409 ALREADY_FOLLOWING` (o pedido só faz sentido enquanto não há follow aprovado).
- **Todo endpoint de `:userId`/`:id` que não existe ou não é seu** responde com o **mesmo** 404 que "nunca existiu" — `FOLLOW_REQUEST_NOT_FOUND`/`FOLLOW_NOT_FOUND` nunca viram `403`. Isso é proposital (P6): não vazar se um pedido/relação de outra pessoa existe.
- **Perfil é privado por padrão** (P6) — sem follow aprovado, a única superfície de alguém é o resultado de `GET /users/search` (P14). Não existe endpoint de "ver perfil público de fulano" nesta API.
- **Auto-notificação nunca acontece** — se por algum motivo o ator de uma ação for o próprio destinatário (não deveria ser possível no fluxo normal de follow), nenhuma notificação é criada.

## Erros específicos deste fluxo

`CANNOT_FOLLOW_SELF`, `ALREADY_FOLLOWING`, `FOLLOW_REQUEST_NOT_FOUND`, `FOLLOW_NOT_FOUND`, `NOT_FOUND` (`:userId` do pedido não existe como usuário) — detalhes em `error-catalog.md`.
