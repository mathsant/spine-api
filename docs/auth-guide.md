# Guia de autenticação

A API usa **access token curto (JWT) + refresh token opaco rotativo**. Tokens trafegam em JSON no corpo — nunca em cookie. Contratos completos em `docs/openapi.yaml` (tag `auth`); códigos de erro citados aqui estão detalhados em `error-catalog.md`.

## Obtendo os tokens

- **Cadastro** (`POST /auth/signup`) cria a conta mas **não autentica** — não retorna tokens. Depois de cadastrar, chame `login`.
- **Login** (`POST /auth/login`) com `email`/`password` retorna um `TokenPair`:

  ```json
  { "accessToken": "...", "refreshToken": "...", "tokenType": "Bearer", "expiresIn": 900 }
  ```

  `expiresIn` é sempre `900` (15 minutos) — vida do `accessToken`.

## Usando o access token

Envie em todo endpoint protegido:

```
Authorization: Bearer <accessToken>
```

- Header ausente, esquema diferente de `Bearer`, ou valor vazio → `401 UNAUTHENTICATED`.
- Token presente mas expirado, malformado, com assinatura inválida, ou referenciando uma conta que não existe mais → `401 INVALID_ACCESS_TOKEN`.

Nos dois casos a ação correta do cliente é a mesma: tentar `refresh` uma vez; se `refresh` também falhar, mandar o usuário para a tela de login.

## Renovando com o refresh token

Chame `POST /auth/refresh` com `{ "refreshToken": "..." }` **antes** que o access token expire (proativo, ex.: num timer a cada ~13 minutos) ou reativamente, na primeira resposta `401` de qualquer endpoint. A resposta é um `TokenPair` novo — **descarte o refresh token anterior**, ele já foi invalidado (rotação: cada refresh token só serve uma vez).

Possíveis erros de `refresh`, todos `401`:

| `code` | O que significa | O que o cliente deve fazer |
|---|---|---|
| `INVALID_REFRESH_TOKEN` | Token desconhecido, ou pertence a uma sessão já revogada (logout, troca de senha, ou reuso detectado anteriormente). | Mandar para login — não há como recuperar essa sessão. |
| `REFRESH_TOKEN_EXPIRED` | A sessão ficou inativa por mais de ~30 dias. | Mandar para login. |
| `REFRESH_TOKEN_REUSE_DETECTED` | Um refresh token **já rotacionado** foi reapresentado — sinal de token vazado/reuso indevido, ou uma corrida de duas chamadas de refresh simultâneas com o mesmo token antigo. **A sessão inteira é revogada como efeito colateral**, antes mesmo de a resposta voltar. | Mandar para login. Se isso acontecer com frequência para um mesmo usuário, é sinal de bug no cliente chamando `refresh` mais de uma vez em paralelo com o mesmo token — o cliente deve serializar chamadas de refresh (nunca duas em voo ao mesmo tempo). |

## Logout

`POST /auth/logout` com `{ "refreshToken": "..." }` revoga a sessão daquele refresh token. É **idempotente**: chamar de novo com um token já revogado ou desconhecido também responde `204` — a resposta nunca revela se o token existia (não vaza informação de sessão de terceiro).

## Troca de senha

`POST /auth/change-password` (autenticado) exige `currentPassword` + `newPassword`, e opcionalmente `refreshToken`:

- Se o `refreshToken` enviado for válido para a conta, **essa sessão é preservada** — o usuário continua logado no dispositivo atual.
- Todas as **outras** sessões de refresh da conta são revogadas — equivalente a "sair de todos os outros dispositivos" sempre que a senha muda.
- `currentPassword` errada → `401 INVALID_CREDENTIALS` (mesmo código/mensagem do login com senha errada).

## Identidade do usuário autenticado

`GET /me` retorna o usuário completo (`id`, `email`, `handle`, `displayName`, `bio`, `createdAt`) — é o jeito de "quem sou eu" depois de um refresh de página no front-end, sem precisar guardar tudo isso no client. Não confundir com `PATCH /me` (edição de perfil, ver `flows/auth-flow.md` e `flows/reading-flow.md` para o resto dos fluxos) — a resposta de `PATCH /me` é menor (sem `email`/`createdAt`); busque `GET /me` de novo se precisar desses dois campos depois de editar.
