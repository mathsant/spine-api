<!-- title: Catálogo de erros -->

# Catálogo de erros

Consolida os catálogos que antes viviam um por feature (`specs/00N-*/contracts/error-codes.md`, de 002 a 008) num único lugar. Fonte da verdade: `src/errors/*.error.ts` (classes) cruzado com onde cada uma é lançada em `src/services/**` e `src/repositories/**`.

## Envelope

Toda resposta de erro da API segue o mesmo formato, não importa o domínio:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "statusCode": 400,
    "details": [{ "path": "email", "message": "Invalid email" }]
  }
}
```

- `code` casa com `^[A-Z][A-Z0-9_]*$` — é o campo que o front-end deve usar para decidir o que fazer (nunca faça `switch` em cima de `message`, que é texto livre).
- `statusCode` repete o HTTP status da resposta.
- `details` só aparece em `VALIDATION_ERROR`, como lista de `{ path, message }` — um item por campo inválido.
- Nenhuma resposta de erro expõe segredo, token, hash de senha ou stack trace do driver do MongoDB — erros de infraestrutura (ex.: MongoDB fora do ar) sempre chegam ao cliente como `DATABASE_UNAVAILABLE` genérico, nunca com a mensagem crua do driver.
- Um erro não tratado que não seja uma das classes abaixo vira `INTERNAL_ERROR` (500) — código literal, sem classe própria na hierarquia (é o "catch-all" do error handler).

## Tabela de códigos

| `code` | HTTP | Classe (`src/errors/`) | Onde ocorre | Quando acontece |
|---|---|---|---|---|
| `VALIDATION_ERROR` | 400 | `ValidationError` | Qualquer endpoint com corpo/query validado por `zod` | Corpo ou querystring reprovado pelo schema. `details` lista os campos. |
| `NOT_FOUND` | 404 | `NotFoundError` | `POST /users/{userId}/follow-request` | `:userId` do pedido de follow não existe como usuário. |
| `USER_NOT_FOUND` | 404 | `UserNotFoundError` | `GET /users/{userId}`, `GET /users/{userId}/activity` | `userId` não corresponde a nenhum usuário (inclusive identificador malformado), OU o usuário existe mas não é visível para você (`.../activity` sem follow aprovado). As duas situações respondem exatamente igual — não vaza a existência de perfil privado (P6). Nunca `403`, nunca `400` por causa de `userId`. |
| `DATABASE_UNAVAILABLE` | 503 | `DatabaseUnavailableError` | Qualquer endpoint que dependa do MongoDB | O banco não responde — erro de infraestrutura, não de regra de negócio. |
| `EMAIL_ALREADY_IN_USE` | 409 | `EmailAlreadyInUseError` | `POST /auth/signup` | O e-mail normalizado já pertence a uma conta. |
| `HANDLE_ALREADY_IN_USE` | 409 | `HandleAlreadyInUseError` | `POST /auth/signup` | O handle normalizado já pertence a uma conta. |
| `INVALID_CREDENTIALS` | 401 | `InvalidCredentialsError` | `POST /auth/login`, `POST /auth/change-password` | E-mail inexistente OU senha errada no login (mensagem idêntica nos dois casos, de propósito); senha atual errada na troca de senha. |
| `UNAUTHENTICATED` | 401 | `UnauthenticatedError` | Qualquer endpoint protegido | `Authorization` ausente, esquema diferente de `Bearer`, ou `Bearer` com valor vazio. |
| `INVALID_ACCESS_TOKEN` | 401 | `InvalidAccessTokenError` | Qualquer endpoint protegido | Access token presente mas inutilizável: assinatura inválida, `alg` errado, malformado, expirado, ou a conta referenciada não existe mais. |
| `INVALID_REFRESH_TOKEN` | 401 | `InvalidRefreshTokenError` | `POST /auth/refresh` | Token desconhecido/forjado, ou pertence a uma sessão já revogada (logout, troca de senha, reuso detectado). |
| `REFRESH_TOKEN_EXPIRED` | 401 | `RefreshTokenExpiredError` | `POST /auth/refresh` | A sessão está inativa há mais de 30 dias. |
| `REFRESH_TOKEN_REUSE_DETECTED` | 401 | `RefreshTokenReuseDetectedError` | `POST /auth/refresh` | Um elo já rotacionado foi reapresentado (replay ou corrida) — a sessão inteira é revogada como efeito colateral, antes de o erro ser lançado. |
| `TOO_MANY_REQUESTS` | 429 | `TooManyRequestsError` | `POST /auth/signup`, `POST /auth/login` | Limite de tentativas por IP (signup) ou por IP+e-mail (login) excedido na janela. |
| `BOOK_NOT_FOUND` | 404 | `BookNotFoundError` | `GET /books/{olid}`, `PUT/DELETE /books/{olid}/want-to-read`, `POST /books/{olid}/start-reading`, `POST /books/{olid}/mark-finished` | `olid` não existe nem no cache local nem no Open Library. |
| `OPEN_LIBRARY_UNAVAILABLE` | 503 | `OpenLibraryUnavailableError` | `GET /books/search`, `GET /books/{olid}`, `POST /books/{olid}/start-reading`, `POST /books/{olid}/mark-finished` | Timeout, erro de rede ou resposta 5xx do Open Library. |
| `READING_SESSION_NOT_FOUND` | 404 | `ReadingSessionNotFoundError` | `POST /reading-sessions/{sessionId}/progress`, `.../finish`, `PATCH/DELETE /reading-sessions/{sessionId}`, `POST /reading-sessions/{sessionId}/review` | `sessionId` não existe, ou existe mas pertence a outro usuário — as duas situações respondem exatamente igual (não vaza que a session de outra pessoa existe). |
| `INVALID_READING_SESSION_STATE` | 409 | `InvalidReadingSessionStateError` | `POST /reading-sessions/{sessionId}/progress` | A session não está no status `reading` (ex.: já está `finished`). |
| `INVALID_READING_SESSION_DATES` | 422 | `InvalidReadingSessionDatesError` | `PATCH /reading-sessions/{sessionId}` | A edição resultaria em `finishedAt` anterior a `startedAt`. |
| `CANNOT_FOLLOW_SELF` | 422 | `CannotFollowSelfError` | `POST /users/{userId}/follow-request` | `:userId` é o próprio usuário autenticado. |
| `ALREADY_FOLLOWING` | 409 | `AlreadyFollowingError` | `POST /users/{userId}/follow-request` | Já existe follow aprovado do remetente para o alvo. |
| `FOLLOW_REQUEST_NOT_FOUND` | 404 | `FollowRequestNotFoundError` | `DELETE /users/{userId}/follow-request`, `.../approve`, `.../reject` | Não existe pedido pendente para o par esperado (nunca existiu, já foi resolvido, ou não pertence ao usuário autenticado). |
| `FOLLOW_NOT_FOUND` | 404 | `FollowNotFoundError` | `DELETE /users/{userId}/follow`, `DELETE /users/{userId}/follower` | Não existe relação de follow aprovada para o par esperado. |
| `REVIEW_NOT_FOUND` | 404 | `ReviewNotFoundError` | `PATCH/DELETE /reviews/{reviewId}` | `reviewId` não existe ou pertence a outro usuário. |
| `REVIEW_ALREADY_EXISTS` | 409 | `ReviewAlreadyExistsError` | `POST /reading-sessions/{sessionId}/review` | A session já tem uma review — uma session admite no máximo uma. |
| `READING_SESSION_NOT_FINISHED` | 409 | `ReadingSessionNotFinishedError` | `POST /reading-sessions/{sessionId}/review` | A session não está `finished` — só é possível avaliar leitura já concluída. |
| `ACTIVITY_NOT_FOUND` | 404 | `ActivityNotFoundError` | `POST/GET /activities/{activityId}/comments`, `POST/DELETE /activities/{activityId}/reactions` | `activityId` não existe, ou existe mas o usuário autenticado não é o dono nem segue aprovado o dono — as duas respostas são idênticas (perfil privado). |
| `UNSUPPORTED_ACTIVITY_INTERACTION` | 422 | `UnsupportedActivityInteractionError` | `POST/GET /activities/{activityId}/comments`, `POST/DELETE /activities/{activityId}/reactions` | O item alvo é do tipo `started_reading` — esse tipo não aceita comentário nem curtida. |
| `COMMENT_NOT_FOUND` | 404 | `CommentNotFoundError` | `POST /activities/{activityId}/comments`, `DELETE /comments/{commentId}` | `parentCommentId` não existe/não é desse item (ao criar), ou `commentId` não existe/não pertence ao usuário autenticado (ao apagar). |
| `COMMENT_NESTING_TOO_DEEP` | 422 | `CommentNestingTooDeepError` | `POST /activities/{activityId}/comments` | `parentCommentId` aponta para uma resposta (nível 2), não para um comentário de nível 1 — aninhamento é limitado a 1 nível. |
| `REACTION_NOT_FOUND` | 404 | `ReactionNotFoundError` | `DELETE /activities/{activityId}/reactions` | O usuário autenticado tentou remover uma curtida que nunca deu. |
| `NOTIFICATION_NOT_FOUND` | 404 | `NotificationNotFoundError` | `POST /notifications/{notificationId}/read` | `notificationId` não existe, ou existe mas pertence a outro usuário. |
| `INTERNAL_ERROR` | 500 | — (sem classe; literal do error handler) | Qualquer endpoint | Qualquer exceção que não seja uma instância de erro conhecida (`AppError`) — corpo genérico, sem detalhe interno. |

## Invariantes

- `INVALID_CREDENTIALS` tem exatamente a mesma `message` para "e-mail não existe" e "senha errada" — a verificação de senha roda mesmo quando o e-mail não é encontrado, então o tempo de resposta também não vaza a diferença.
- `NOT_FOUND`/`*_NOT_FOUND` nunca distinguem "não existe" de "existe mas não é seu/não é visível" — ambos os casos retornam exatamente o mesmo corpo e status (evita vazar a existência de dado privado).
- `details` só aparece em `VALIDATION_ERROR`.
- Todo `code` referenciado aqui existe em `docs/openapi.yaml` com o mesmo nome, e vice-versa.
