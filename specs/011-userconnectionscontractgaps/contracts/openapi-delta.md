# Contrato — delta de `docs/openapi.yaml`

Tudo que muda em `docs/openapi.yaml` nesta feature. Ao final, `pnpm docs:lint` (`npx redocly lint docs/openapi.yaml`) DEVE passar sem erros novos (os 2 warnings pré-existentes em `/health` são tolerados). Estilo: mesmas chaves inline, `additionalProperties: false`, `required` explícito, já usados no arquivo.

---

## 1. `paths` — 3 operações novas

### 1.1 `GET /users/{userId}` — `operationId: getUserProfile`

Inserir no bloco `# ---- users`, logo após `/users/search`:

```yaml
  /users/{userId}:
    get:
      tags: [users]
      operationId: getUserProfile
      summary: >
        Perfil de uma pessoa. `id`/`handle`/`displayName`/`avatarUrl` sempre; `bio`
        só se você segue essa pessoa (follow aprovado), senão `null`. `followState` é
        o seu estado em relação a ela; `followsYou`, o dela em relação a você.
      parameters: [{ $ref: "#/components/parameters/UserId" }]
      responses:
        "200":
          description: Perfil visível (nível de detalhe depende de `followState`).
          content:
            application/json:
              schema: { $ref: "#/components/schemas/UserProfile" }
              examples:
                naoSigo:
                  value: { id: "64b7f0c2e1a2b3c4d5e6f001", handle: "ana_leitora", displayName: "Ana", avatarUrl: null, bio: null, followState: "none", followsYou: false }
                sigoAprovado:
                  value: { id: "64b7f0c2e1a2b3c4d5e6f002", handle: "bruno", displayName: "Bruno", avatarUrl: null, bio: "Lendo ficção científica e ensaios.", followState: "following", followsYou: true }
                pedidoPendente:
                  value: { id: "64b7f0c2e1a2b3c4d5e6f003", handle: "dora", displayName: "Dora", avatarUrl: null, bio: null, followState: "pending", followsYou: false }
        "401": { $ref: "#/components/responses/Unauthenticated" }
        "404": { $ref: "#/components/responses/UserNotFound" }
```

### 1.2 `GET /users/{userId}/activity` — `operationId: listUserActivity`

Logo após `/users/{userId}`:

```yaml
  /users/{userId}/activity:
    get:
      tags: [feed]
      operationId: listUserActivity
      summary: >
        Atividade recente de uma pessoa, mais recente primeiro, paginada por cursor.
        Só acessível se você segue essa pessoa (follow aprovado) ou é o próprio
        usuário; qualquer outro caso responde o mesmo `404 USER_NOT_FOUND` de
        `GET /users/{userId}`. Cada item tem o mesmo formato de `GET /feed`.
      parameters:
        - { $ref: "#/components/parameters/UserId" }
        - { $ref: "#/components/parameters/Cursor" }
        - { $ref: "#/components/parameters/Limit" }
      responses:
        "200":
          description: Página do cursor (vazia se a pessoa é acessível mas não tem atividade).
          content:
            application/json:
              schema: { $ref: "#/components/schemas/FeedCursorPage" }
              examples:
                comAtividade:
                  value:
                    items:
                      - id: "64b7f0c2e1a2b3c4d5e6a101"
                        type: "review_published"
                        createdAt: "2026-09-01T12:00:00.000Z"
                        actor: { userId: "64b7f0c2e1a2b3c4d5e6f002", handle: "bruno", displayName: "Bruno" }
                        book: { id: "64b7f0c2e1a2b3c4d5e6b001", title: "Duna", authors: ["Frank Herbert"], coverUrl: null }
                        readingSessionId: "64b7f0c2e1a2b3c4d5e6c001"
                        currentPage: null
                        review: { id: "64b7f0c2e1a2b3c4d5e6d001", sessionId: "64b7f0c2e1a2b3c4d5e6c001", rating: 5, text: "Melhor releitura do ano.", containsSpoiler: false, createdAt: "2026-09-01T12:00:00.000Z", updatedAt: "2026-09-01T12:00:00.000Z" }
                        reactionsCount: 2
                        hasReacted: false
                    nextCursor: null
                vazia:
                  value: { items: [], nextCursor: null }
        "400": { $ref: "#/components/responses/ValidationError" }
        "401": { $ref: "#/components/responses/Unauthenticated" }
        "404": { $ref: "#/components/responses/UserNotFound" }
```

### 1.3 `GET /me/stats` — `operationId: getMyStats`

Inserir no bloco de `/me...` (perto de `/me/follow-requests` / `/me/want-to-read`):

```yaml
  /me/stats:
    get:
      tags: [profile]
      operationId: getMyStats
      summary: >
        Contadores-resumo do próprio usuário para a tela de perfil. `booksRead` conta
        livros distintos com pelo menos uma leitura finalizada (reler o mesmo livro
        conta 1). `pendingFollowRequests` são só os pedidos recebidos e ainda não
        respondidos. `GET /me` não muda — esses contadores vivem só aqui.
      responses:
        "200":
          description: Contadores atuais do usuário autenticado.
          content:
            application/json:
              schema: { $ref: "#/components/schemas/MyStats" }
              examples:
                usuarioAtivo:
                  value: { booksRead: 12, followers: 8, following: 12, pendingFollowRequests: 3, wantToRead: 4 }
                usuarioNovo:
                  value: { booksRead: 0, followers: 0, following: 0, pendingFollowRequests: 0, wantToRead: 0 }
        "401": { $ref: "#/components/responses/Unauthenticated" }
```

---

## 2. `components.responses` — 1 resposta reutilizável nova

Adicionar junto das demais em `components/responses`:

```yaml
    UserNotFound:
      description: >
        `USER_NOT_FOUND` — `userId` não corresponde a nenhum usuário, OU o usuário
        existe mas não é visível para você (ex.: `GET /users/{userId}/activity` sem
        follow aprovado). As duas situações respondem exatamente igual — não vaza a
        existência de perfil privado (P6). Nunca `403`.
      content: { application/json: { schema: { $ref: "#/components/schemas/ErrorResponse" } } }
```

---

## 3. `components.schemas` — 2 schemas novos

```yaml
    UserProfile:
      type: object
      additionalProperties: false
      required: [id, handle, displayName, avatarUrl, bio, followState, followsYou]
      properties:
        id: { type: string }
        handle: { type: string, pattern: "^[a-z0-9_]{3,30}$" }
        displayName: { type: string }
        avatarUrl: { type: [string, "null"], description: "Sempre `null` por enquanto — upload de avatar não existe na API." }
        bio:
          type: [string, "null"]
          description: >
            Texto só quando `followState === "following"`; caso contrário `null`
            (indistinguível de bio vazia — intencional, P6).
        followState:
          type: string
          enum: [none, pending, following]
          description: "Seu estado em relação a este usuário: `none` (sem relação), `pending` (você tem pedido de follow pendente para ele), `following` (você o segue, aprovado)."
        followsYou:
          type: boolean
          description: "`true` só quando este usuário segue você com follow aprovado (pedido pendente dele para você não conta)."

    MyStats:
      type: object
      additionalProperties: false
      required: [booksRead, followers, following, pendingFollowRequests, wantToRead]
      properties:
        booksRead: { type: integer, minimum: 0, description: "Livros distintos com >= 1 leitura finalizada. Reler o mesmo livro conta 1." }
        followers: { type: integer, minimum: 0 }
        following: { type: integer, minimum: 0 }
        pendingFollowRequests: { type: integer, minimum: 0, description: "Pedidos de follow recebidos e ainda não respondidos. Não inclui os que você enviou." }
        wantToRead: { type: integer, minimum: 0 }
```

---

## 4. `components.schemas` — 3 schemas alterados (D4)

Em cada um, acrescentar `followState` e `followsYou` a `properties` **e** a `required`. Semântica idêntica à de `UserProfile` (mesma descrição de enum/boolean — pode referenciar em prosa "ver `UserProfile.followState`").

### 4.1 `UserSearchResult`

```yaml
    UserSearchResult:
      type: object
      additionalProperties: false
      required: [id, handle, displayName, avatarUrl, followState, followsYou]
      properties:
        id: { type: string }
        handle: { type: string }
        displayName: { type: string }
        avatarUrl: { type: [string, "null"] }
        followState: { type: string, enum: [none, pending, following], description: "Seu estado em relação a este usuário (ver `UserProfile.followState`)." }
        followsYou: { type: boolean, description: "`true` se este usuário segue você (follow aprovado)." }
```

### 4.2 `FollowedUser` (itens de `/me/followers` e `/me/following`)

```yaml
    FollowedUser:
      type: object
      additionalProperties: false
      required: [userId, handle, displayName, createdAt, followState, followsYou]
      properties:
        userId: { type: string }
        handle: { type: string }
        displayName: { type: string }
        createdAt: { type: string, format: date-time }
        followState:
          type: string
          enum: [none, pending, following]
          description: "Seu estado em relação a este usuário. Em `GET /me/following` é sempre `following`; em `GET /me/followers` indica se você segue de volta."
        followsYou:
          type: boolean
          description: "`true` se este usuário segue você (follow aprovado). Em `GET /me/followers` é sempre `true`."
```

### 4.3 `FollowRequestItem`

```yaml
    FollowRequestItem:
      type: object
      additionalProperties: false
      required: [userId, handle, displayName, direction, createdAt, followState, followsYou]
      properties:
        userId: { type: string, description: "O outro lado do pedido (quem pediu, se `incoming`; quem recebeu, se `outgoing`)." }
        handle: { type: string }
        displayName: { type: string }
        direction: { type: string, enum: [incoming, outgoing] }
        createdAt: { type: string, format: date-time }
        followState:
          type: string
          enum: [none, pending, following]
          description: "Seu estado em relação a este usuário. Em `direction: outgoing` é sempre `pending`."
        followsYou:
          type: boolean
          description: "`true` se este usuário segue você (follow aprovado). Em `direction: incoming` é `false` enquanto o pedido não for aprovado por você."
```

---

## 5. Verificação cruzada rota ↔ schema (feita no gate de docs)

- `getUserProfile` → `UserProfile` ✔ ; erro `UserNotFound` ✔
- `listUserActivity` → `FeedCursorPage` (já existe, reuso) ✔ ; erro `UserNotFound` ✔
- `getMyStats` → `MyStats` ✔
- `searchUsers` → `UserSearchPage` → `UserSearchResult` (+2 campos) ✔
- `listFollowers` / `listFollowing` → `FollowCursorPage` → `FollowedUser` (+2 campos) ✔
- `listFollowRequests` → `FollowRequestCursorPage` → `FollowRequestItem` (+2 campos) ✔
- Nenhuma mudança em `PublicUser`, `Profile`, `FeedItem`, `Review`.
