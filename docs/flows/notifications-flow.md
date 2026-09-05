# Fluxo: notificações

Registro persistido de eventos relevantes para o usuário. Entrega é **por polling** neste MVP — não há push/SSE/WebSocket (fora de escopo, ver `product.md`). O cliente deve chamar `GET /me/notifications/unread-count` periodicamente (ex.: a cada 30–60s, ou ao voltar o foco da aba) para saber se há algo novo, e só buscar a lista completa quando o usuário abrir o painel de notificações.

## Passo a passo

1. **Contagem não lida** (para o badge/sino) — `GET /me/notifications/unread-count` (`getUnreadNotificationCount`) → `{ count: number }`.
2. **Listar** — `GET /me/notifications` (`listNotifications`), paginado por cursor, mais recente primeiro.
3. **Marcar uma como lida** — `POST /notifications/{notificationId}/read` (`markNotificationRead`), idempotente.
4. **Marcar todas como lidas** — `POST /notifications/read-all` (`markAllNotificationsRead`), idempotente.

## Os 5 tipos de notificação

| `type` | Quando é criada | Quem recebe |
|---|---|---|
| `follow_request` | Alguém envia um pedido de follow para mim. | O alvo do pedido. |
| `follow_approved` | Meu pedido de follow foi aprovado. | Quem pediu (não quem aprovou). |
| `comment_on_content` | Alguém comenta em um item de feed que é meu. | O dono do item de feed. |
| `comment_reply` | Alguém responde a um comentário meu. | O autor do comentário-pai. |
| `reaction_on_content` | Alguém curte um item de feed que é meu. | O dono do item de feed. |

## Regras de negócio não óbvias

- **Recusa de follow nunca notifica** — `POST /users/{userId}/follow-request/reject` apaga o pedido silenciosamente; quem pediu não recebe `follow_request` "resolvido" nem nada equivalente (decisão de produto, evita constrangimento).
- **Sem auto-notificação** — se o ator de uma ação for a mesma pessoa que receberia a notificação (não deveria acontecer no uso normal, mas é uma garantia do backend), nenhum registro é criado.
- **Responder a um comentário gera no máximo 2 notificações, nunca notificação duplicada para a mesma pessoa**: se eu respondo ao comentário de A num item que é de B, A recebe `comment_reply` e B recebe `comment_on_content` — mas se A e B forem a mesma pessoa (respondi ao dono do próprio item), só uma notificação (`comment_reply`) é criada.
- **Apagar o conteúdo original limpa a notificação correspondente**: apagar um comentário remove as notificações geradas por ele; descurtir remove a notificação daquela curtida; apagar uma reading session remove todas as notificações ligadas a ela; apagar uma review remove as notificações de comentário/curtida vinculadas ao item de feed daquela review. Isso evita notificação "órfã" apontando para algo que não existe mais.
- **`Notification` nunca é editada** — só criada, marcada como lida, ou removida como efeito colateral de outra ação (nunca há um endpoint de "editar o texto de uma notificação").
- **A API não monta o texto da notificação** (tipo "fulano comentou na sua review") — o corpo é `{ id, type, actorId, activityId, commentId, read, createdAt }`; montar a frase exibida ao usuário (com `type` + os dados de `actorId`/`activityId` buscados à parte) é responsabilidade do cliente.

## Erros específicos deste fluxo

`NOTIFICATION_NOT_FOUND` (ao marcar como lida uma notificação que não existe ou não é sua) — detalhes em `error-catalog.md`.
