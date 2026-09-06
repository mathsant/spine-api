# Quickstart — validar `GET /users/suggestions` (012-followsuggestions)

Passos manuais para conferir a feature depois do `/implement`. Assume a API rodando
localamente (`npm run dev`) com MongoDB acessível e o fluxo de auth funcionando.

## Pré-requisitos

- 6+ usuários de teste: `me`, `ana`, `bruno`, `carla`, `dora`, `eva`, `felipe`.
- Access token de `me` em `$TOKEN`.

## Cenário 1 — amigos-de-amigos, ordenado por `mutualFollowersCount`

1. `me` segue `ana` e `bruno` (envie os follow-requests e aprove-os pelos alvos).
2. `ana` segue `carla` e `dora`. `bruno` segue `carla`.
3. `GET /v1/users/suggestions` com `Authorization: Bearer $TOKEN`.
4. **Esperado**: `200`, `items` com `carla` (`mutualFollowersCount: 2`) **antes** de
   `dora` (`mutualFollowersCount: 1`). Ambos com `followState: "none"`, `avatarUrl: null`.

## Cenário 2 — exclusões

1. Estado do Cenário 1, e agora `me` já segue `carla` (follow aprovado) e tem
   follow-request **pendente** para `dora`.
2. `GET /v1/users/suggestions`.
3. **Esperado**: nem `carla` nem `dora` aparecem. Se não sobrar mais ninguém na rede,
   `items: []` (e **não** uma lista de populares).

## Cenário 3 — cap de 4

1. Faça as pessoas que `me` segue seguirem 6+ contas novas (nenhuma seguida por `me`).
2. `GET /v1/users/suggestions`.
3. **Esperado**: exatamente 4 itens — os 4 de maior `mutualFollowersCount` (desempate:
   mais seguidores, depois conta mais recente).

## Cenário 4 — cold start (não segue ninguém)

1. Novo usuário `zoe`, token em `$TOKEN_ZOE`, sem seguir ninguém. Outras contas têm
   seguidores (de outros usuários).
2. `GET /v1/users/suggestions` com o token de `zoe`.
3. **Esperado**: `200`, até 4 contas mais seguidas da plataforma, **todas** com
   `mutualFollowersCount: 0`. `zoe` nunca aparece na própria lista.

## Cenário 5 — recusa não exclui

1. `me` pediu para seguir `felipe` e `felipe` **recusou**.
2. `felipe` é seguido por `ana` (que `me` segue).
3. `GET /v1/users/suggestions`.
4. **Esperado**: `felipe` aparece normalmente (recusa não deixa rastro).

## Cenário 6 — `followsYou`

1. `eva` segue `me` (follow aprovado); `me` não segue `eva`. `eva` também é seguida por
   `ana` (que `me` segue).
2. `GET /v1/users/suggestions`.
3. **Esperado**: `eva` no `items` com `followsYou: true`, `followState: "none"`.

## Cenário 7 — sem token

1. `GET /v1/users/suggestions` sem header `Authorization`.
2. **Esperado**: `401` no envelope de erro padrão (`UNAUTHENTICATED`).

## Cenário 8 — não é sombreado por `/users/:userId`

1. `GET /v1/users/suggestions` (com token válido).
2. **Esperado**: responde a lista de sugestões — **não** um `404 USER_NOT_FOUND` de
   "usuário `suggestions` não existe".

## Checagem de performance (RNF / DoD)

No shell do Mongo, com dados de teste carregados, rode o `explain` das agregações do
service (amigos-de-amigos, contagem de seguidores, popularidade global) e confirme:

- estágio `IXSCAN` (nunca `COLLSCAN`);
- nenhum `FETCH` antes do `$group` (os campos usados estão no índice).
