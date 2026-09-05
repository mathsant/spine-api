# Fluxo: cadastro, login, refresh, logout

Cobre a jornada completa de conta: criar, entrar, manter a sessão viva, e sair. Para o mecanismo de token em si (obtenção, renovação, erros), ver `docs/auth-guide.md` — este documento é sobre a sequência de chamadas e as regras de negócio por trás dela.

## Passo a passo

1. **Cadastro** — `POST /auth/signup` (`signup` em `docs/openapi.yaml`) com `email`, `password`, `handle`, `displayName`. Cria a conta mas **não autentica** (não retorna token) — o cliente deve levar o usuário para a tela de login em seguida.
2. **Login** — `POST /auth/login` (`login`) com `email`/`password`. Retorna `TokenPair`. Guarde `accessToken` e `refreshToken` no cliente (ver `auth-guide.md` para como/quando renovar).
3. **Uso normal** — toda chamada a um endpoint protegido leva `Authorization: Bearer <accessToken>`.
4. **Renovação** — `POST /auth/refresh` (`refresh`) antes do access token expirar (~15 min) ou reativamente ao primeiro `401`.
5. **Logout** — `POST /auth/logout` (`logout`) com o `refreshToken` da sessão atual. Idempotente.
6. **Troca de senha** (opcional, dentro da sessão) — `POST /auth/change-password` (`changePassword`), autenticado.

## Regras de negócio não óbvias

- **`handle` é imutável** (decisão de produto P11 de `product.md`) — não existe endpoint de troca de handle. `signup` aceita caixa mista no `handle`, mas o servidor normaliza para minúsculo; o valor salvo e retornado é sempre a forma normalizada.
- **`INVALID_CREDENTIALS` não distingue** "e-mail não existe" de "senha errada" — a mensagem é idêntica nos dois casos, de propósito, para não revelar quais e-mails têm conta.
- **Rate limit por IP** em `signup` e por IP+e-mail em `login` — depois de várias tentativas na janela, a API responde `429 TOO_MANY_REQUESTS` mesmo com credenciais corretas. O cliente deve mostrar essa mensagem de forma diferente de "senha errada".
- **Troca de senha revoga as outras sessões** — se o usuário estiver logado em mais de um dispositivo/navegador e trocar a senha em um deles, os outros são deslogados na próxima tentativa de `refresh` (a sessão atual é preservada só se o `refreshToken` dela for enviado no corpo de `change-password`).
- **`GET /me` não é a mesma coisa que `PATCH /me`** — o primeiro é sobre identidade (login/refresh de página), o segundo é edição de perfil (ver `reading-flow.md`... na verdade ver o guia de auth: `PATCH /me` devolve uma forma menor, sem `email`/`createdAt`).

## Erros específicos deste fluxo

Ver a tabela completa em `error-catalog.md`. Os relevantes aqui: `VALIDATION_ERROR`, `EMAIL_ALREADY_IN_USE`, `HANDLE_ALREADY_IN_USE` (signup); `INVALID_CREDENTIALS`, `TOO_MANY_REQUESTS` (login); `INVALID_REFRESH_TOKEN`, `REFRESH_TOKEN_EXPIRED`, `REFRESH_TOKEN_REUSE_DETECTED` (refresh); `UNAUTHENTICATED`, `INVALID_ACCESS_TOKEN` (qualquer chamada autenticada, incluindo `change-password` e `GET /me`).
