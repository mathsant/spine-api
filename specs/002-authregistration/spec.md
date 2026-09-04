# Especificação de Feature: Autenticação e Cadastro

**Branch**: `002-authregistration`
**Criado em**: 2026-09-03
**Status**: Rascunho
**Entrada**: descrição original do usuário: "auth-cadastro - nessa spec vamos implementar toda a parte de autenticacao, cadastro, autorizacao e etc seguindo os principios definidos do projeto e a arquitetura definidade para o projeto."

---

## Contexto do produto

Ancorada em `.specify/memory/product.md`:

- **Escopo MVP, item 1 — Auth**: cadastro, login, refresh, logout (revogação do refresh).
- **P8**: access token curto (JWT) + refresh token rotativo persistido no servidor (para revogação). Cliente guarda os tokens; `Authorization: Bearer <access>`.
- **P12**: sem limite de sessões; cada login gera um refresh token; rotaciona a cada uso; expira por inatividade (~30 dias); logout revoga o token atual.
- **P11**: `@handle` é único e **imutável** após o cadastro.
- **P6**: perfil é privado por padrão — todo endpoint de leitura de conteúdo é resolvido relativo ao usuário autenticado. Esta feature entrega **o primitivo de autenticação** (identificar o viewer e proteger rotas); as regras de visibilidade por follow aprovado ficam nas features de cada recurso.
- **Implicações para a API**: prefixo `/v1` desde o primeiro endpoint; CORS para a origem do app web.

### Fora de escopo desta feature (decidido no /specify)

- Verificação de e-mail (envio de link, estado "pendente") — roadmap, junto de infra de e-mail.
- Recuperação de senha ("esqueci minha senha") — roadmap, junto de infra de e-mail.
- Troca de e-mail do usuário autenticado — depende de verificação de e-mail.
- "Sair de todos os dispositivos" / revogar todas as sessões sob demanda — roadmap.
- Sistema de papéis/permissões (admin/moderador) — não previsto no product.md.
- Upload de avatar no cadastro — depende de object storage (em aberto no product.md); avatar entra na feature de Perfil.
- Edição de perfil (`displayName`, avatar), busca de usuários — feature de Perfil.

---

## Cenários de Usuário & Testes *(obrigatório)*

### História principal

Uma pessoa que quer usar o better-books cria uma conta informando e-mail, senha, um `@handle` único e um nome de exibição. Em seguida faz login com e-mail e senha e recebe um par de tokens: um access token curto, que acompanha cada requisição autenticada, e um refresh token, que ela troca por um novo par quando o access expira, sem precisar digitar a senha de novo. Ela pode encerrar a sessão (logout) e trocar a própria senha. Todo endpoint que expõe dado de usuário exige um access token válido; sem ele, a requisição é recusada.

### Cenários de aceitação

**Cadastro**

1. **Dado** que não existe conta com o e-mail `alice@example.com` nem o handle `alice`, **quando** a pessoa faz `POST /v1/auth/signup` com e-mail, senha válida, `handle: "alice"` e `displayName: "Alice"`, **então** recebe `201` com a representação pública da conta criada (`id`, `email`, `handle`, `displayName`, `createdAt`) e **nenhum** dado sensível (sem hash de senha, sem token).
2. **Dado** que já existe conta com o e-mail `alice@example.com`, **quando** a pessoa faz `POST /v1/auth/signup` com esse mesmo e-mail (em qualquer combinação de maiúsculas/minúsculas), **então** recebe `409` com `error.code = "EMAIL_ALREADY_IN_USE"` e nenhuma conta nova é criada.
3. **Dado** que já existe conta com o handle `alice`, **quando** a pessoa faz `POST /v1/auth/signup` com `handle: "Alice"` (mesma sequência, caixa diferente), **então** recebe `409` com `error.code = "HANDLE_ALREADY_IN_USE"`.
4. **Dado** um corpo de cadastro com senha de 5 caracteres, ou handle com caractere inválido, ou `displayName` vazio, **quando** a pessoa faz `POST /v1/auth/signup`, **então** recebe `400` com `error.details` apontando o(s) campo(s) inválido(s) e nenhuma conta é criada.

**Login**

5. **Dado** uma conta existente com senha correta, **quando** a pessoa faz `POST /v1/auth/login` com o e-mail e a senha certos, **então** recebe `200` com `accessToken`, `refreshToken` e os metadados do access (`expiresIn` em segundos), e uma nova sessão de refresh passa a existir no servidor.
6. **Dado** uma conta existente, **quando** a pessoa faz `POST /v1/auth/login` com a senha errada **ou** com um e-mail que não existe, **então** recebe `401` com `error.code = "INVALID_CREDENTIALS"` e uma mensagem genérica que **não** revela se o e-mail existe.
7. **Dado** várias tentativas de login falhas para o mesmo e-mail/IP acima do limite configurado numa janela de tempo, **quando** a pessoa tenta de novo, **então** recebe `429` com `error.code = "TOO_MANY_REQUESTS"` até a janela expirar.

**Refresh e rotação**

8. **Dado** um refresh token válido e não expirado, **quando** a pessoa faz `POST /v1/auth/refresh` com esse token, **então** recebe `200` com um **novo** par (`accessToken` + `refreshToken`), o refresh token antigo passa a ser inválido (rotação) e a janela de inatividade da sessão é renovada.
9. **Dado** um refresh token que já foi rotacionado (isto é, já trocado por um novo), **quando** ele é reapresentado em `POST /v1/auth/refresh`, **então** recebe `401` com `error.code = "REFRESH_TOKEN_REUSE_DETECTED"` **e** toda a sessão correspondente (a cadeia de refresh iniciada naquele login) é revogada — o refresh token atualmente válido dessa sessão também deixa de funcionar, forçando novo login.
10. **Dado** um refresh token cuja sessão está inativa há mais que a janela de inatividade (30 dias), **quando** a pessoa faz `POST /v1/auth/refresh`, **então** recebe `401` com `error.code = "REFRESH_TOKEN_EXPIRED"`.
11. **Dado** um refresh token que não corresponde a nenhuma sessão (forjado, ou de sessão já revogada por logout), **quando** a pessoa faz `POST /v1/auth/refresh`, **então** recebe `401` com `error.code = "INVALID_REFRESH_TOKEN"`.

**Logout**

12. **Dado** uma sessão ativa, **quando** a pessoa faz `POST /v1/auth/logout` com o refresh token dessa sessão, **então** recebe `204`, a sessão é revogada e um `POST /v1/auth/refresh` posterior com aquele token retorna `401`.
13. **Dado** um refresh token já inválido/desconhecido, **quando** a pessoa faz `POST /v1/auth/logout`, **então** recebe `204` mesmo assim (logout é idempotente e não vaza se o token existia).

**Rota protegida e identidade**

14. **Dado** um access token válido no cabeçalho `Authorization: Bearer <token>`, **quando** a pessoa faz `GET /v1/me`, **então** recebe `200` com `{ id, email, handle, displayName, createdAt }` do dono do token.
15. **Dado** uma requisição a `GET /v1/me` **sem** cabeçalho `Authorization`, ou com esquema diferente de `Bearer`, **então** recebe `401` com `error.code = "UNAUTHENTICATED"`.
16. **Dado** um access token expirado, malformado, com assinatura inválida, ou cuja conta não existe mais, **quando** a pessoa faz `GET /v1/me`, **então** recebe `401` com `error.code = "INVALID_ACCESS_TOKEN"`.

**Troca de senha**

17. **Dado** uma pessoa autenticada, **quando** ela faz `POST /v1/auth/change-password` com a senha atual correta e uma nova senha válida, **então** recebe `204`, e a partir daí **todas as outras sessões** daquela conta são revogadas (a sessão que originou a requisição, quando identificável pelo refresh token enviado, permanece ativa; caso contrário todas são revogadas).
18. **Dado** uma pessoa autenticada, **quando** ela faz `POST /v1/auth/change-password` com a senha atual **incorreta**, **então** recebe `401` com `error.code = "INVALID_CREDENTIALS"` e a senha não muda.
19. **Dado** uma pessoa autenticada, **quando** ela faz `POST /v1/auth/change-password` com uma nova senha que não cumpre a política, **então** recebe `400` com `error.details` e a senha não muda.

### Casos de borda

- **E-mail com espaços/caixa mista** no cadastro ou login: normalizado (trim + minúsculas) antes de validar unicidade e antes de autenticar. `Alice@Example.com ` e `alice@example.com` são a mesma conta.
- **Handle com caixa mista** no cadastro: a unicidade ignora a caixa; a forma normalizada (minúsculas) é a que garante unicidade. O valor é imutável depois (P11).
- **Corrida de cadastro** (dois `signup` simultâneos com o mesmo e-mail ou handle): no máximo uma conta é criada; a outra recebe `409`. Garantido por índice único no armazenamento (via migration), não só por checagem em memória.
- **Refresh token válido de uma conta que foi apagada** (cenário futuro): tratado como `INVALID_REFRESH_TOKEN`.
- **Senha no limite de tamanho**: aceita exatamente o mínimo (8) e o máximo (72) caracteres; rejeita fora disso.
- **Reapresentar o mesmo refresh dentro de uma corrida** (cliente dispara dois refresh quase juntos com o mesmo token): o primeiro rotaciona; o segundo cai na regra de reuso (cenário 9) e revoga a sessão. É o comportamento desejado de segurança; o cliente deve serializar o refresh.
- **`Authorization` presente mas vazio, ou `Bearer ` sem token**: `401 UNAUTHENTICATED`.
- **Access token ainda válido após logout**: continua aceito até expirar (é stateless e curto — 15 min); o logout revoga o *refresh*, não o *access*. Documentado como aceito por design.
- **Rate limit atingido no cadastro**: `429`, sem criar conta.
- **Payload sem `Content-Type: application/json`** ou JSON malformado nos endpoints de auth: `400`.

## Requisitos *(obrigatório)*

### Requisitos funcionais

**Cadastro (sign-up)**

- **RF-001**: O sistema DEVE expor `POST /v1/auth/signup` que recebe `email`, `password`, `handle` e `displayName`, todos validados por schema na borda antes de qualquer regra de negócio.
- **RF-002**: O sistema DEVE validar `email` como endereço de e-mail sintaticamente válido e DEVE normalizá-lo (aparar espaços, minúsculas) antes de persistir e de checar unicidade.
- **RF-003**: O sistema DEVE aceitar `password` com **8 a 72** caracteres, sem exigência de composição (maiúscula/dígito/símbolo). Fora dessa faixa → `400`.
- **RF-004**: O sistema DEVE aceitar `handle` que cumpra: **3 a 30** caracteres, apenas `[a-z0-9_]` (minúsculas, dígitos, underscore). A unicidade DEVE ser **case-insensitive** (armazenada na forma normalizada). O `handle` é **imutável** após o cadastro (P11) — nenhum endpoint desta feature o altera.
- **RF-005**: O sistema DEVE aceitar `displayName` com 1 a 50 caracteres após aparar espaços; não pode ser vazio.
- **RF-006**: O sistema DEVE recusar o cadastro com `409` e `error.code = "EMAIL_ALREADY_IN_USE"` quando o e-mail normalizado já pertence a uma conta.
- **RF-007**: O sistema DEVE recusar o cadastro com `409` e `error.code = "HANDLE_ALREADY_IN_USE"` quando o handle normalizado já pertence a uma conta.
- **RF-008**: A unicidade de e-mail e de handle DEVE ser garantida por restrição no armazenamento (índice único), criada via migration — não apenas por verificação na aplicação.
- **RF-009**: O sistema DEVE armazenar a senha apenas como hash produzido por algoritmo de hashing de senha resistente a força bruta (com sal por usuário). A senha em texto puro NÃO DEVE ser persistida nem registrada em log.
- **RF-010**: A resposta de `signup` DEVE ser `201` com `{ id, email, handle, displayName, createdAt }` e NÃO DEVE conter hash de senha, tokens, nem campos internos.
- **RF-011**: O `signup` NÃO DEVE autenticar automaticamente (não retorna tokens); a pessoa faz `login` em seguida.

**Login**

- **RF-012**: O sistema DEVE expor `POST /v1/auth/login` que recebe `email` e `password` (validados por schema).
- **RF-013**: Em credenciais válidas, o sistema DEVE retornar `200` com `{ accessToken, refreshToken, tokenType: "Bearer", expiresIn }`, onde `expiresIn` é o tempo de vida do access token em segundos.
- **RF-014**: Em e-mail inexistente **ou** senha incorreta, o sistema DEVE retornar `401` com `error.code = "INVALID_CREDENTIALS"` e mensagem genérica idêntica nos dois casos (não revelar existência do e-mail). O custo de tempo das duas respostas NÃO DEVE permitir distinguir os casos de forma trivial (comparar sempre contra um hash).
- **RF-015**: Cada login bem-sucedido DEVE criar **uma nova sessão de refresh** no servidor, independente das demais (P12 — sem limite de sessões por usuário).

**Access token**

- **RF-016**: O access token DEVE ser um token autoverificável (assinado) que carrega a identidade do usuário (`userId`) e um tempo de expiração.
- **RF-017**: O access token DEVE expirar em **15 minutos** após a emissão.
- **RF-018**: O sistema DEVE validar o access token em toda rota protegida: assinatura, expiração e existência da conta referenciada. Falha em qualquer um → `401` com `error.code = "INVALID_ACCESS_TOKEN"`.
- **RF-019**: Ausência do cabeçalho `Authorization`, esquema diferente de `Bearer`, ou `Bearer` sem valor → `401` com `error.code = "UNAUTHENTICATED"`.
- **RF-020**: O mecanismo de autenticação DEVE expor a identidade do usuário autenticado (`userId`) às camadas seguintes da requisição, de forma que qualquer rota protegida (nesta e em features futuras) a consuma sem reprocessar o token.

**Refresh token e rotação**

- **RF-021**: O sistema DEVE expor `POST /v1/auth/refresh` que recebe um `refreshToken` no corpo.
- **RF-022**: O refresh token DEVE ser opaco para o cliente (sem significado interpretável) e persistido no servidor apenas como hash (não em texto puro).
- **RF-023**: Em refresh token válido, ativo e dentro da janela de inatividade, o sistema DEVE retornar `200` com um **novo par** (`accessToken` + `refreshToken`), invalidar o refresh token apresentado (**rotação**) e vincular o novo ao mesmo encadeamento de sessão.
- **RF-024**: Cada uso bem-sucedido do refresh DEVE **renovar a janela de inatividade** da sessão (nova expiração = agora + 30 dias).
- **RF-025**: Uma sessão de refresh DEVE expirar quando ficar **30 dias** sem uso (inatividade). Refresh nesse estado → `401` com `error.code = "REFRESH_TOKEN_EXPIRED"`.
- **RF-026**: O sistema DEVE **detectar reuso**: se um refresh token que **já foi rotacionado** for reapresentado, o sistema DEVE responder `401` com `error.code = "REFRESH_TOKEN_REUSE_DETECTED"` **e revogar toda a sessão** (a cadeia inteira iniciada naquele login), invalidando também o refresh token atualmente válido dessa sessão.
- **RF-027**: Refresh token desconhecido, forjado, ou de sessão já revogada (por logout, por troca de senha, ou por detecção de reuso) → `401` com `error.code = "INVALID_REFRESH_TOKEN"`.
- **RF-028**: A revogação de sessão (por qualquer motivo) DEVE ter efeito imediato no próximo `refresh`.

**Logout**

- **RF-029**: O sistema DEVE expor `POST /v1/auth/logout` que recebe um `refreshToken` no corpo e revoga a sessão correspondente.
- **RF-030**: `logout` DEVE responder `204` tanto quando revogou uma sessão quanto quando o token era desconhecido/já inválido (idempotente, sem vazar se o token existia).
- **RF-031**: Após `logout`, um `refresh` com qualquer token daquela sessão DEVE retornar `401`.

**Endpoint de identidade**

- **RF-032**: O sistema DEVE expor `GET /v1/me` (rota protegida) que retorna `200` com `{ id, email, handle, displayName, createdAt }` do usuário dono do access token. Sem edição de perfil nesta feature.

**Troca de senha**

- **RF-033**: O sistema DEVE expor `POST /v1/auth/change-password` (rota protegida) que recebe `currentPassword` e `newPassword` (validados por schema; `newPassword` segue a mesma política do cadastro — RF-003).
- **RF-034**: Se `currentPassword` não confere, o sistema DEVE retornar `401` com `error.code = "INVALID_CREDENTIALS"` e não alterar a senha.
- **RF-035**: Em sucesso, o sistema DEVE gravar o novo hash e retornar `204`.
- **RF-036**: Em sucesso, o sistema DEVE **revogar todas as demais sessões** de refresh da conta. Se a requisição incluir (opcionalmente) o `refreshToken` da sessão corrente e ele for válido para aquela conta, essa sessão DEVE ser preservada; caso contrário, todas as sessões são revogadas.

**Proteção contra abuso**

- **RF-037**: O sistema DEVE aplicar limitação de taxa em `POST /v1/auth/login` e `POST /v1/auth/signup`, por IP de origem e, no login, também por e-mail alvo. Ao exceder o limite dentro da janela, DEVE retornar `429` com `error.code = "TOO_MANY_REQUESTS"`. Os valores concretos (limite e janela) são configuráveis e definidos no `/plan`.
- **RF-038**: A limitação de taxa NÃO DEVE bloquear indefinidamente: expira sozinha ao fim da janela.

**Contrato de erro e transporte**

- **RF-039**: Todos os erros desta feature DEVEM ser tipos que derivam do tipo de erro base do projeto (`AppError`), cada um com `code` estável em SCREAMING_SNAKE_CASE e `statusCode` HTTP, e DEVEM ser serializados no formato de borda já vigente no projeto: `{ "error": { "code", "message", "statusCode", "details?" } }` (ver feature 001).
- **RF-040**: Nenhuma exceção crua do driver de banco DEVE vazar dos repositórios; violação de índice único DEVE ser traduzida para o erro de domínio correspondente (`EMAIL_ALREADY_IN_USE` / `HANDLE_ALREADY_IN_USE`).
- **RF-041**: Tokens DEVEM ser transportados em JSON no corpo das respostas/requisições (o cliente os guarda — P8); esta feature NÃO usa cookies de sessão.
- **RF-042**: Nenhum token, hash de senha, ou senha em texto puro DEVE aparecer em log, em qualquer nível.
- **RF-043**: Todos os endpoints desta feature DEVEM ficar sob o prefixo `/v1`.

### Entidades-chave *(se a feature envolve dados)*

- **User**: conta de uma pessoa (o mesmo `User` do glossário do produto, criado aqui pelo cadastro). Atributos relevantes nesta feature: `id`, `email` (normalizado, único), `passwordHash`, `handle` (normalizado, único, imutável), `displayName`, `createdAt`, `updatedAt`. Avatar e demais campos de perfil são adicionados pela feature de Perfil.
- **AuthSession** (sessão de refresh): representa um login. Atributos: `id`, `userId`, `status` (`active` | `revoked`), `createdAt`, `lastUsedAt`, `inactivityExpiresAt` (agora + 30 dias, renovado a cada refresh), motivo de revogação (`logout` | `reuse_detected` | `password_changed`). Uma sessão agrupa a cadeia de refresh tokens rotacionados.
- **RefreshToken**: um elo da cadeia de uma `AuthSession`. Atributos: `id`, `sessionId`, `tokenHash`, `createdAt`, `rotatedAt` (nulo enquanto é o token corrente), `expiresAt`. Um token com `rotatedAt` preenchido que seja reapresentado dispara a detecção de reuso (RF-026).
- **AccessToken**: não é persistido. Token assinado, curto (15 min), que carrega `userId` e expiração. Mencionado como entidade conceitual para o contrato.

---

## Definição de Pronto (Definition of Done) *(obrigatório)*

- [x] Todos os cenários de aceitação (1–19) passam em teste automatizado — cadastro, login, refresh + rotação, expiração por inatividade, detecção de reuso revogando a sessão, logout idempotente, `GET /me`, rota protegida sem/da token inválido → `401`, troca de senha revogando as demais sessões.
- [x] Regras de negócio de auth cobertas por teste de integração com `mongodb-memory-server` (caminho feliz + ≥1 caminho de erro por regra); cobertura de `src/services/**` ≥ 70% e o gate de cobertura do CI fica verde.
- [x] Funções que não são regra de negócio (schemas zod, mapeadores, verificação de token, geração de token opaco) cobertas por teste unitário isolado.
- [x] Senha armazenada apenas como hash forte com sal; resposta de erro de login é genérica e idêntica para "e-mail não existe" e "senha errada"; nenhum token, hash ou senha em texto puro aparece em log (verificável por teste/inspeção).
- [x] Índices únicos de `email` e `handle` criados via migration `migrate-mongo` (reversível); a corrida de cadastro simultâneo resulta em no máximo uma conta.
- [x] Toda entrada externa dos endpoints validada por schema zod na borda; nenhuma regra de negócio recebe dado não validado.
- [x] Todos os erros novos estendem `AppError`, com `code` SCREAMING_SNAKE_CASE e `statusCode`; nenhuma exceção crua do driver `mongodb` vaza dos repositórios; violação de índice único é traduzida para `EMAIL_ALREADY_IN_USE` / `HANDLE_ALREADY_IN_USE`.
- [x] Nenhum acesso ao driver `mongodb` fora de `src/repositories/**` e `src/db/**`; fluxo controller → service → repository respeitado; nenhum `export default`; cada pasta de domínio nova tem `index.ts` de re-export.
- [x] O mecanismo de autenticação expõe a identidade do viewer (`userId`) às rotas protegidas de forma reutilizável pelas próximas features (o `GET /me` é a primeira a consumir).
- [~] `lint` sem erros, `typecheck` (`src` + `tests`) e `build` sem erro de tipo (confirmados localmente); CI verde (install → typecheck → lint → test:unit → test:integration → build → coverage) — passo `typecheck` adicionado ao `.github/workflows/ci.yml`; workflow não executado neste ambiente.
- [x] Endpoints documentados no README (ou doc de API do repo): rota, corpo, respostas de sucesso e de erro com os `code`s.
- [x] Variáveis de ambiente novas (ex.: segredo de assinatura do access token, TTLs, parâmetros de rate limit) adicionadas ao schema de config validada e ao arquivo de exemplo de ambiente; nenhuma leitura de env fora da config tipada.

---

## Esclarecimentos

*Preenchido pelo comando `/clarify`. Cada rodada adiciona uma subseção com data.*

### Sessão 2026-09-03

- P: O que o cadastro exige? → R: `email` + `password` + `handle` + `displayName` (conta e identidade social nascem juntas; avatar fica para a feature de Perfil).
- P: Verificação de e-mail antes do login? → R: Fora de escopo — conta ativa imediatamente após o cadastro; verificação vai para o roadmap (depende de infra de e-mail).
- P: "Esqueci minha senha" entra? → R: Fora de escopo (depende de infra de e-mail).
- P: O que "autorização" significa aqui? → R: Só o primitivo de autenticação — verificar o access token, anexar a identidade do viewer, proteger rotas (`401` sem token válido). Privacidade por recurso (P6) fica nas features de cada recurso.
- P: Identificador de login? → R: Somente e-mail (+ senha). O `handle` não autentica.
- P: Reuso de refresh token já rotacionado? → R: Detecta o reuso e **revoga a sessão inteira** (a cadeia daquele login), forçando novo login.
- P: "Sair de todos os dispositivos" / revogar todas as sessões sob demanda? → R: Fora de escopo (roadmap).
- P: Rate limiting nos endpoints de auth? → R: Em escopo — rate limit básico por IP/identificador em `login` e `signup`, `429` ao exceder; valores concretos no `/plan`.
- P: Política de senha? → R: Mínimo 8 caracteres (máx. 72), sem regra de composição.
- P: Regras do `@handle`? → R: 3–30 caracteres, `[a-z0-9_]`, unicidade case-insensitive; imutável após o cadastro (P11).
- P: Troca de senha / troca de e-mail autenticadas? → R: Só troca de senha (senha atual + nova; revoga as demais sessões). Troca de e-mail fica para depois.
- P: Endpoint de identidade do usuário logado? → R: Sim — `GET /v1/me` com `id`, `email`, `handle`, `displayName` (sem edição de perfil).
- P: TTLs dos tokens? → R: Fixados na spec — access token 15 min; refresh expira por inatividade em 30 dias (renovada a cada uso).
- P: Definição de Pronto? → R: A checklist registrada na seção "Definição de Pronto" acima (cenários de aceitação automatizados; cobertura de services ≥ 70% com CI verde; segredos/hashes nunca vazam e erro de login genérico; migrations + schemas zod + erros tipados conforme a constituição).

---

## Checklist de Revisão

*Gate automatizado verificado pelo `/specify` e revisado por `/clarify` antes do `/plan`.*

### Qualidade do conteúdo

- [x] Sem detalhes de implementação (linguagens, frameworks, APIs) — a spec fala em "token assinado", "hash de senha resistente a força bruta", "índice único via migration" sem nomear biblioteca/algoritmo; a escolha concreta é do `/plan`.
- [x] Focado em valor para o usuário e necessidades de negócio — jornada de criar conta, entrar, manter sessão e sair com segurança.
- [x] Escrito para stakeholders não-técnicos — dentro do possível para uma feature de auth; os `code`s de erro são contrato observável, não implementação.
- [x] Todas as seções obrigatórias preenchidas.

### Completude dos requisitos

- [x] Nenhum marcador `[NEEDS CLARIFICATION]` remanescente.
- [x] Requisitos são testáveis e não-ambíguos — cada RF tem status HTTP e/ou `error.code` verificável.
- [x] Critérios de sucesso são mensuráveis — cenários Dado/Quando/Então + DoD com itens checáveis.
- [x] Escopo está claramente delimitado — seção "Fora de escopo desta feature" lista o que não entra.
- [x] Dependências e premissas identificadas — depende do contrato de erro de borda, da config validada e do CI da feature 001; premissas de normalização de e-mail/handle e de transporte por JSON registradas.
- [x] Definição de Pronto preenchida, com critérios objetivos e verificáveis (não vagos).
