# Fase 1 — Modelo de Dados: `GET /users/suggestions` (012-followsuggestions)

Esta feature **não cria nem altera** nenhuma coleção, campo ou índice. Só **lê** o que já
existe. Abaixo: as entidades persistidas envolvidas (como referência) e as estruturas
derivadas (só em memória / resposta) que a feature introduz.

---

## Entidades persistidas (somente leitura)

### `follows` (coleção `follows`)

| Campo | Tipo | Uso nesta feature |
|---|---|---|
| `_id` | ObjectId | — |
| `followerId` | string (hex de user `_id`) | quem segue |
| `followeeId` | string | quem é seguido |
| `createdAt` | Date | — |

Só relações **aprovadas** vivem aqui (pedido pendente fica em `follow_requests`).
Índices existentes usados: `follows_followerId_followeeId_unique {followerId:1,followeeId:1}`,
`follows_followeeId_followerId {followeeId:1,followerId:1}`, `follows_followerId_createdAt`.

### `follow_requests` (coleção `follow_requests`)

| Campo | Tipo | Uso nesta feature |
|---|---|---|
| `requesterId` | string | viewer, ao excluir pendentes (RF-003c) |
| `targetId` | string | alvo do pedido pendente — excluído das sugestões |

Índice usado: unique `{requesterId:1, targetId:1}`.

### `users` (coleção `users`)

| Campo | Tipo | Uso nesta feature |
|---|---|---|
| `_id` | ObjectId | `id` do item; desempate final (RF-006.3) |
| `handle` | string | campo do item |
| `displayName` | string | campo do item |
| `createdAt` | Date | desempate (RF-006.2) |
| `bio` | string \| null | **não** exposto (P6 — sugestão não é follower aprovado) |

Índice usado: `_id` (default) para `findByIds`.

---

## Estruturas derivadas (não persistidas)

### `SuggestionCandidate` (interno ao service)

Candidato antes da ordenação/corte. Vive só na memória do request.

| Campo | Tipo | Origem |
|---|---|---|
| `userId` | string | `_id` agregado de `follows` |
| `mutualFollowersCount` | number (≥ 1 na trilha A; 0 na trilha B) | `$group $sum` da agregação amigos-de-amigos |
| `followerCount` | number (≥ 0) | `$group $sum` da agregação de contagem de seguidores |
| `handle` | string | `users.findByIds` |
| `displayName` | string | `users.findByIds` |
| `createdAt` | Date | `users.findByIds` |

**Regra de ordenação (comparador puro `compareSuggestionCandidates`)** — RF-006:
1. `mutualFollowersCount` desc
2. `followerCount` desc
3. `createdAt` desc (mais recente primeiro)
4. `userId` desc (ordem total estável)

Corta os **4** primeiros (RF-002).

### `FollowSuggestionDTO` (resposta)

Um item da lista. Shape = `UserSearchResultDTO` + `mutualFollowersCount`.

| Campo | Tipo | Regra |
|---|---|---|
| `id` | string | `_id` do user em hex |
| `handle` | string | — |
| `displayName` | string | — |
| `avatarUrl` | string \| null | **sempre `null`** (RF-010) |
| `followState` | `'none' \| 'pending' \| 'following'` | **sempre `'none'`** nesta rota (RF-009) — quem já segue / tem pendente foi excluído |
| `followsYou` | boolean | `true` se o candidato segue o viewer (follow aprovado) — `followRepository.filterFollowers(viewerId, ids)` |
| `mutualFollowersCount` | integer ≥ 0 | contagem de contas distintas que o viewer segue e que também seguem este candidato (0 na trilha de popularidade) |

### `FollowSuggestionsResponseDTO` (envelope)

| Campo | Tipo | Regra |
|---|---|---|
| `items` | `FollowSuggestionDTO[]` | 0 a 4 itens (RF-002, RF-008, RF-011) — lista vazia é sucesso |

Sem `nextCursor` / `page` / `limit` / `totalItems` — não é paginado (D6).

---

## Invariantes

- `items.length ≤ 4` sempre.
- Nenhum item tem `id === viewerId`.
- Nenhum item é seguido (aprovado) pelo viewer nem tem follow-request pendente do viewer.
- Trilha A: todo item tem `mutualFollowersCount ≥ 1`. Trilha B: todo item tem `mutualFollowersCount === 0`.
- Mesma entrada (estado de `follows` + `follow_requests`) ⇒ mesma saída, na mesma ordem (RF-013).
- `avatarUrl === null` e `followState === 'none'` em todos os itens.
