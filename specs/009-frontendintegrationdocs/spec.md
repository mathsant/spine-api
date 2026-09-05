# Especificação de Feature: Documentação de Integração para o Front-end + Prompt de Design

**Branch**: `009-frontendintegrationdocs`
**Criado em**: 2026-09-05
**Status**: Rascunho
**Entrada**: descrição original do usuário: "backend-doc-for-front - nessa spec vamos criar todas as documentacoes, incluindo contratos, explicacoes dos fluxos das regras de negocio e etc para que o front-end que vai consumir esse app se integre facilmente. Junto com todas essas definicoes, quero tbambem que essa spec gere um prompt DETALHADO e COMPLETO para gerarmos o prototipo de design do app no Claude Design, de ponta a ponta."

## Fluxo de execução (para o agente que preenche este documento)

1. Extraia o conceito principal da descrição do usuário.
2. Identifique atores, ações, dados e restrições envolvidos.
3. Para cada ambiguidade, marque com `[NEEDS CLARIFICATION: pergunta específica]` em vez de assumir.
4. Preencha as seções de Cenários de Usuário e Testes.
5. Gere Requisitos Funcionais — cada um deve ser testável.
6. Identifique Entidades-Chave, se o recurso envolve dados.
7. Pergunte ao usuário qual é a Definição de Pronto (DoD) — quais pontos são primordiais para isto estar DONE — e preencha essa seção com a resposta.
8. Rode o "Checklist de Revisão" abaixo antes de considerar a spec pronta.

**IMPORTANTE**: esta especificação descreve O QUÊ os usuários precisam e POR QUÊ. Evite detalhes de implementação (stack, APIs, estrutura de código) — isso é papel do `/plan`.

---

## Contexto adicional levantado nesta rodada

O repositório já tem, espalhados em `specs/001-backendappsetup/` até `specs/008-notificationflow/`, um `*.openapi.yaml` e um `error-codes.md` por feature, organizados por ordem cronológica de implementação (não por domínio de negócio). Essa feature não parte do zero: ela **consolida, reorganiza e completa** esse material disperso em um pacote único, coerente e voltado para quem vai construir o front-end — que não precisa (nem deveria precisar) saber que a API foi construída em 8 rodadas incrementais.

Decisões tomadas com o usuário para esta rodada:

- **Contrato**: os OpenAPI por feature são **unificados em um único documento OpenAPI**, cobrindo toda a API hoje implementada (`auth`, `books`, `follows`, `profile`, `users`, `reading-sessions`, `reviews`, `feed`, `comments`, `reactions`, `notifications`, `health`). Esse arquivo único vira a fonte da verdade para o front-end — ele não deve precisar abrir os OpenAPI antigos por feature.
- **Idioma**: toda a documentação nova (guias de fluxo, catálogo de erros, prompt de design) é em **português**, consistente com `product.md` e as specs existentes.
- **Localização**: os artefatos vivem em uma pasta **`docs/` na raiz do repositório** (versionada, e não amarrada ao ciclo de vida de uma feature específica) — diferente do padrão `specs/00N/contracts/` usado até aqui, justamente porque este material deve continuar sendo a referência viva mesmo depois que a feature 009 for considerada concluída.
- **Exemplos**: bastam exemplos de request/response inline no OpenAPI/Markdown; não é necessário produzir coleção Postman/Insomnia nesta rodada.
- **Prompt de design**: plataforma alvo é **web responsivo mobile-first**; direção estética é **aconchegante/literária (warm, editorial)**; **apenas tema claro** nesta rodada (dark mode fica fora); escopo de telas é **exatamente as 9 áreas do MVP** já travadas em `product.md` (auth, perfil/busca, follow, livros, reading session, review, feed, interações, notificações) — nada a mais, nada a menos.

---

## Cenários de Usuário & Testes *(obrigatório)*

### História principal

Uma pessoa (o próprio usuário deste projeto, ou alguém que ele designar) vai começar a construir o app web que consome a API do better-books. Hoje, para entender qualquer fluxo, essa pessoa precisaria vasculhar 8 pastas de spec diferentes, cada uma com seu próprio OpenAPI e catálogo de erros, escritos ao longo do tempo conforme cada feature foi implementada. Com esta feature, essa pessoa abre uma única pasta de documentação, entende a API inteira (contratos, autenticação, regras de negócio por fluxo, formato de erro, paginação, bloco `viewer`) sem precisar ler código-fonte nem specs antigas, e sai com um prompt pronto para colar no Claude Design e gerar o protótipo visual completo do app.

### Cenários de aceitação

1. **Dado** que a API já tem 8 features implementadas e mescladas (auth, catálogo de livros, perfil/follow, reviews, feed, interações, notificações), **quando** a pessoa abre `docs/`, **então** ela encontra um único documento OpenAPI cobrindo 100% dos endpoints hoje expostos por `src/controllers/**`, sem precisar consultar os OpenAPI antigos por feature.
2. **Dado** o documento de contratos, **quando** a pessoa procura o formato de um erro (ex.: `409 EMAIL_ALREADY_IN_USE`), **então** ela encontra, num único catálogo de erros, todo `code` possível por endpoint, o HTTP status correspondente e uma explicação de quando ele ocorre — sem precisar abrir 8 arquivos `error-codes.md` diferentes.
3. **Dado** que a pessoa nunca viu o domínio do produto, **quando** ela lê o guia do fluxo de "seguir alguém" (`follow`), **então** ela entende, em linguagem de negócio (não de código), que o follow é assimétrico, exige aprovação do alvo, e que só depois da aprovação o conteúdo do alvo fica visível — sem precisar ler `product.md` nem os controllers.
4. **Dado** que todo DTO de leitura carrega um bloco `viewer` (ex.: `isFollowing`, `hasReacted`, `myReadingStatus`), **quando** a pessoa consulta a documentação, **então** ela encontra, em um único lugar, quais campos existem em `viewer` para cada tipo de recurso e o que cada um significa.
5. **Dado** que a autenticação usa access token curto + refresh token rotativo, **quando** a pessoa lê o guia de autenticação, **então** ela entende como armazenar os tokens, quando/como chamar refresh, o que fazer quando o access token expira em uma chamada, e o que acontece em reuso de refresh token detectado (revogação de sessão).
6. **Dado** que o feed e outras listas usam paginação por cursor, **quando** a pessoa lê o guia correspondente, **então** ela entende o formato do cursor, como pedir a próxima página e como detectar o fim da lista, sem inferir isso a partir do código.
7. **Dado** que a spec está completa, **quando** a pessoa lê o prompt de design gerado, **então** o prompt é auto-suficiente: ao colá-lo no Claude Design sem contexto adicional, alguém consegue gerar um protótipo cobrindo as 9 áreas do MVP, em web responsivo mobile-first, com direção estética aconchegante/literária e tema claro, refletindo corretamente as regras de negócio (perfil privado por padrão, follow com aprovação, nota 1–5 em estrela cheia, spoiler como flag + texto sempre visível para o cliente decidir, etc.).
8. **Dado** que a documentação foi gerada, **quando** ela é comparada campo a campo com o que está implementado em `src/` (schemas, controllers, DTOs), **então** não há nenhuma divergência — a documentação reflete o comportamento real do código, não a intenção original das specs por feature.

### Casos de borda

- O que acontece quando um endpoint existente em `src/controllers/**` não tiver um OpenAPI correspondente em nenhuma das 8 specs antigas (schema esquecido)? A documentação unificada deve incluí-lo mesmo assim, derivando o contrato do código-fonte atual (schemas `zod`, controller, rotas).
- Como a documentação lida com um erro que existe no código mas nunca foi listado em nenhum `error-codes.md` de feature? Ele deve ser identificado (varredura de `src/errors/*.error.ts` e dos `throw` em services/controllers) e incluído no catálogo consolidado.
- O que acontece se, durante a consolidação, for encontrada uma divergência entre o que uma spec antiga descreve e o que o código realmente faz hoje (ex.: uma regra mudou durante a implementação e a spec não foi atualizada)? A documentação nova deve refletir o **código atual**, e a divergência encontrada deve ser sinalizada explicitamente (não silenciada) para quem revisar.
- Como o prompt de design lida com dados que só existem no domínio via `id`/referência (ex.: capa de livro vinda de URL externa do Open Library)? O prompt deve orientar a usar placeholders/mocks plausíveis (ex.: capas de livro genéricas), já que o Claude Design não tem acesso à API real.
- O que o prompt de design faz com áreas listadas como "fora do MVP" em `product.md` (ex.: DNF, clubes de leitura, metas de leitura)? Elas devem ficar **fora** do prompt — o protótipo cobre só as 9 áreas do MVP confirmadas.

## Requisitos *(obrigatório)*

### Requisitos funcionais

**Contrato da API (OpenAPI unificado)**

- **RF-001**: Deve existir um único documento OpenAPI, em `docs/`, cobrindo 100% dos endpoints HTTP hoje expostos pela API (todos os domínios em `src/controllers/**`: `auth`, `books`, `follows`, `profile`, `users`, `reading-sessions`, `reviews`, `feed`, `comments`, `reactions`, `notifications`, `health`).
- **RF-002**: O documento OpenAPI unificado DEVE ser derivado do comportamento **atual** do código-fonte (schemas `zod` em `src/schemas/**`, controllers, rotas) — não deve ser uma simples concatenação acrítica dos 8 OpenAPI antigos, caso algum deles esteja desatualizado em relação ao código.
- **RF-003**: Cada endpoint no documento unificado DEVE descrever: método HTTP, path, autenticação exigida (se houver), parâmetros de path/query, corpo de request (quando aplicável), formato do corpo de sucesso (incluindo o bloco `viewer` quando presente no DTO), e todos os códigos de erro possíveis para aquele endpoint.
- **RF-004**: O documento OpenAPI unificado DEVE ser organizado/agrupado por domínio de negócio (auth, livros, follow, perfil/busca de usuário, reading session, review, feed, interações, notificações), não por número de feature de implementação.

**Guias de fluxo de negócio**

- **RF-005**: Deve existir, em `docs/`, uma explicação narrativa (não apenas o contrato técnico) de cada fluxo de negócio crítico, escrita para quem vai consumir a API e não necessariamente conhece o domínio: (a) cadastro, login, refresh e logout; (b) enviar/aprovar/recusar pedido de follow, deixar de seguir, remover seguidor; (c) buscar livro, marcar `want_to_read`, iniciar leitura, registrar progresso, finalizar leitura (com e sem review); (d) criar/editar/apagar review; (e) consumir o feed paginado; (f) comentar e curtir itens de feed; (g) listar e marcar notificações como lidas.
- **RF-006**: Cada guia de fluxo de negócio DEVE explicitar as regras de negócio não óbvias a partir do contrato técnico isolado — por exemplo: follow é assimétrico e exige aprovação; perfil é privado por padrão e todo endpoint de leitura filtra pelo espectador; nota é inteiro 1–5; reler um livro cria uma nova reading session independente; recusar um follow request nunca gera notificação; ninguém recebe notificação de uma ação sobre si mesmo.
- **RF-007**: Deve existir, em `docs/`, um guia dedicado de autenticação explicando: como obter access/refresh token, como e quando renovar via refresh, o que fazer quando uma chamada retorna token expirado/inválido, o que acontece em reuso de refresh token detectado, e como o header `Authorization: Bearer` deve ser enviado.
- **RF-008**: Deve existir, em `docs/`, um guia dedicado de paginação explicando o formato do cursor usado no feed e nas demais listas paginadas, como solicitar a próxima página e como identificar o fim da lista.
- **RF-009**: Deve existir, em `docs/`, uma referência única do bloco `viewer` presente nos DTOs de leitura, listando, por tipo de recurso (usuário, livro, review, item de feed, etc.), quais campos existem nesse bloco e o que cada um significa do ponto de vista de quem está vendo (o "espectador" autenticado).

**Catálogo de erros**

- **RF-010**: Deve existir, em `docs/`, um catálogo único de erros consolidando todos os `code` de erro possíveis na API, com: HTTP status, em quais endpoints ele pode ocorrer, e uma explicação de quando ele acontece — substituindo a necessidade de consultar os 8 `error-codes.md` separados.
- **RF-011**: O catálogo de erros DEVE incluir o formato padrão do envelope de erro (`{ error: { code, message, statusCode, details? } }`) e as invariantes já estabelecidas (ex.: `details` só aparece em erro de validação; nenhuma resposta de erro expõe segredo, token ou stack trace).
- **RF-012**: O catálogo de erros DEVE ser derivado de uma varredura do código-fonte atual (classes em `src/errors/**` e os pontos onde são lançadas), não apenas dos `error-codes.md` antigos, para capturar qualquer erro implementado que não tenha sido documentado na feature original.

**Prompt para o Claude Design**

- **RF-013**: Esta feature DEVE produzir um prompt de texto, único e auto-suficiente, destinado a ser colado no Claude Design para gerar um protótipo visual do app better-books de ponta a ponta.
- **RF-014**: O prompt DEVE cobrir exatamente as 9 áreas do MVP travadas em `product.md`: autenticação/onboarding, perfil (ver/editar o próprio + busca de usuário), follow (pedir/aprovar/recusar/listar), catálogo de livros (buscar, abrir livro, `want_to_read`), reading session (iniciar, progresso, finalizar), review (criar/ver nota+texto+spoiler), feed (paginado), interações (comentar/curtir) e notificações (listar/marcar lida) — nenhuma tela fora dessas áreas, nenhuma dessas áreas ausente.
- **RF-015**: O prompt DEVE especificar plataforma-alvo **web responsiva, mobile-first** (layout pensado primeiro para telas estreitas, adaptando-se depois para desktop).
- **RF-016**: O prompt DEVE especificar direção estética **aconchegante/literária (warm, editorial)** — tom pessoal e íntimo, coerente com o produto ser um círculo fechado e privado por padrão — e exigir **apenas tema claro** (sem variação escura nesta rodada).
- **RF-017**: O prompt DEVE traduzir, para quem for gerar o design, as regras de negócio que afetam a interface — por exemplo: perfil privado exige um estado visual de "conteúdo bloqueado até aprovação de follow"; nota é estrela cheia 1–5 (sem meia-estrela); review pode ter nota sem texto; spoiler é uma flag visível na UI, não um bloqueio de conteúdo pela API; feed é só de quem o usuário segue e foi aprovado.
- **RF-018**: O prompt DEVE orientar o uso de dados mockados plausíveis (capas de livro, nomes, avatares) para as telas, já que o Claude Design não tem acesso à API real.
- **RF-019**: O prompt final DEVE ser apresentado ao usuário como um artefato revisável dentro desta feature, e só é considerado concluído após aprovação explícita do usuário — gerar um prompt plausível sem essa aprovação não satisfaz este requisito.

**Consistência com o código**

- **RF-020**: Toda a documentação produzida por esta feature (contrato, guias de fluxo, catálogo de erros) DEVE refletir o comportamento **atual** do código em `src/`, e não a intenção original de cada spec por feature — qualquer divergência encontrada entre uma spec antiga e o código atual deve ser resolvida a favor do código, e sinalizada como nota na documentação nova.

### Entidades-chave

- **API Contract**: representação unificada, machine-readable, de todos os endpoints da API (método, path, autenticação, request, response, erros). Consolida os 8 `*.openapi.yaml` existentes em um só, reorganizado por domínio.
- **Flow Guide**: documento narrativo, por fluxo de negócio (auth, follow, reading session, review, feed, interações, notificações), explicando o "porquê" e as regras não óbvias de cada fluxo para quem consome a API.
- **Error Catalog**: lista única de todo `code` de erro possível na API, com HTTP status, endpoints onde ocorre e explicação — consolida os 8 `error-codes.md` existentes.
- **Design Prompt**: texto único, auto-suficiente, a ser colado no Claude Design, cobrindo as 9 áreas do MVP, plataforma (web responsivo mobile-first), direção estética (aconchegante/literária, tema claro) e as regras de negócio que afetam a interface.

---

## Definição de Pronto (Definition of Done) *(obrigatório)*

- [x] O documento OpenAPI unificado cobre 100% dos endpoints hoje implementados em `src/controllers/**` e valida sem erros num validador de schema OpenAPI (ex.: `swagger-cli`/`spectral` ou equivalente escolhido no `/plan`). — `docs/openapi.yaml`: 43/43 endpoints (`grep` das rotas reais vs. métodos documentados), `npm run docs:lint` (`@redocly/cli`) sem erros (2 avisos de estilo aceitos e justificados: `info.license` sem `url`/`identifier`; `GET /health` sem 4xx — endpoint público sem parâmetros, não tem o que validar).
- [x] Todos os fluxos de negócio críticos listados no RF-005 têm guia narrativo próprio, e o catálogo de erros consolidado (RF-010) cobre todo `code` de erro identificado em `src/errors/**`, incluindo o bloco `viewer` documentado (RF-009). — 7 arquivos em `docs/flows/`; `docs/error-catalog.md` com 31 linhas (30 classes de `src/errors/*.error.ts` + `INTERNAL_ERROR` literal), cruzado com `docs/openapi.yaml`; `docs/viewer-block.md` documenta o que existe de fato (`hasReacted`/`reactionsCount`) e sinaliza que o bloco `viewer` genérico do `product.md` nunca foi implementado.
- [x] O prompt de design (RF-013 a RF-019) foi apresentado ao usuário como artefato revisável e aprovado explicitamente por ele — não apenas gerado. — `docs/design-prompt.md` apresentado nesta conversa e aprovado explicitamente pelo usuário ("Aprovado.").
- [x] Nenhum trecho da documentação nova diverge do comportamento atual do código em `src/`; toda divergência encontrada entre spec antiga e código foi resolvida a favor do código e sinalizada como nota. — 2 divergências corrigidas e anotadas no cabeçalho de `docs/openapi.yaml` (campos `reactionsCount`/`hasReacted` ausentes no `feed.openapi.yaml` original; `review` presente em toda resposta de `ReadingSession`, não só na listagem); 1 divergência de `product.md` (bloco `viewer` nunca implementado) anotada em `docs/viewer-block.md`.

---

## Esclarecimentos

### Sessão 2026-09-05

- P: Como tratar os OpenAPI e error-codes.md já existentes, um por feature (001-008)? → R: Unificar num único OpenAPI, cobrindo toda a API, organizado por domínio de negócio.
- P: Em que idioma escrever a nova documentação? → R: Português, consistente com o restante do projeto.
- P: Onde os artefatos de documentação devem viver? → R: `docs/` na raiz do repositório (persistente, fora do padrão `specs/00N/contracts/`).
- P: O front-end precisa de coleção Postman/Insomnia pronta além dos exemplos inline? → R: Não, exemplos inline no OpenAPI/Markdown bastam.
- P: Qual plataforma-alvo para o protótipo do Claude Design? → R: Web responsivo mobile-first.
- P: Qual direção estética para o prompt de design? → R: Aconchegante/literária (warm, editorial).
- P: O protótipo precisa de tema claro e escuro? → R: Só tema claro nesta rodada.
- P: O escopo de telas "de ponta a ponta" cobre exatamente as 9 áreas do MVP do product.md? → R: Sim, exatamente essas 9 áreas, nenhuma a mais nem a menos.
- P: Quais pontos são primordiais para considerar esta feature DONE? → R: OpenAPI unificado cobrindo 100% dos endpoints e validando sem erros; fluxos críticos e catálogo de erros documentados (incluindo bloco `viewer`); prompt do Claude Design aprovado explicitamente pelo usuário; documentação sem divergência do código-fonte atual.

---

## Checklist de Revisão

*Gate automatizado verificado pelo `/specify` e revisado por `/clarify` antes do `/plan`.*

### Qualidade do conteúdo

- [x] Sem detalhes de implementação (linguagens, frameworks, APIs)
- [x] Focado em valor para o usuário e necessidades de negócio
- [x] Escrito para stakeholders não-técnicos
- [x] Todas as seções obrigatórias preenchidas

### Completude dos requisitos

- [x] Nenhum marcador `[NEEDS CLARIFICATION]` remanescente
- [x] Requisitos são testáveis e não-ambíguos
- [x] Critérios de sucesso são mensuráveis
- [x] Escopo está claramente delimitado
- [x] Dependências e premissas identificadas
- [x] Definição de Pronto preenchida, com critérios objetivos e verificáveis (não vagos)
