# Modelo dos artefatos de documentação

Esta feature não introduz entidade de banco de dados nenhuma. As "entidades" abaixo são os **artefatos de documentação** definidos na spec (seção "Entidades-chave") — este documento descreve a forma/estrutura mínima de cada um, para orientar o `/tasks` e servir de checklist de completude.

## API Contract (`docs/openapi.yaml`)

Documento único OpenAPI 3.1, cobrindo os 43 endpoints em 12 domínios.

| Campo/seção | Obrigatório | Descrição |
|---|---|---|
| `info` | sim | título, versão (`v1`, alinhado ao prefixo `/v1` da API), descrição curta do propósito da API |
| `servers` | sim | ao menos a base URL relativa `/v1` |
| `tags` | sim | uma tag por domínio de negócio (`auth`, `books`, `follows`, `profile`, `users`, `reading-sessions`, `reviews`, `feed`, `comments`, `reactions`, `notifications`, `health`) — não por número de feature |
| `paths.<path>.<method>` | sim, para cada um dos 43 endpoints | `operationId`, `tags`, `summary`, `security` (quando exige `Authorization: Bearer`), `parameters` (path/query), `requestBody` (quando houver), `responses` |
| `paths.<path>.<method>.responses.2xx` | sim | schema do corpo de sucesso, incluindo o bloco `viewer` quando o DTO carregar um (ver `viewer-block.md`) |
| `paths.<path>.<method>.responses.4xx/5xx` | sim | todo `code` de erro possível para aquele endpoint, referenciando o mesmo `code` do `error-catalog.md` |
| `components.schemas` | sim | schemas reutilizáveis por domínio (evitar duplicar o mesmo shape de `User`, `Book`, `ReadingSession` etc. em cada endpoint) |
| `components.securitySchemes` | sim | esquema `bearerAuth` (JWT) usado pelos endpoints autenticados |

**Regra de validação**: `npx redocly lint docs/openapi.yaml` sem erro (ver `research.md`, Decisão 1).

## Flow Guide (`docs/flows/<domain>-flow.md`, um por item do RF-005)

| Campo/seção | Obrigatório | Descrição |
|---|---|---|
| Título + 1 parágrafo de contexto | sim | o que esse fluxo representa no produto, em linguagem de negócio |
| Passo a passo do fluxo | sim | sequência de chamadas (endpoint + quando chamar), incluindo variações (ex.: "finalizar leitura com e sem review") |
| Regras de negócio não óbvias | sim | as regras que não dá pra inferir só olhando o contrato técnico (RF-006) — cada regra referencia a decisão de produto correspondente em `product.md` (P1, P5, P9, P10, P13 etc.) quando aplicável |
| Erros específicos do fluxo | sim | quais `code` do `error-catalog.md` esse fluxo pode retornar e em que passo |
| Referência cruzada ao OpenAPI | sim | link para o(s) `operationId` correspondente(s) em `docs/openapi.yaml` |

Os 7 arquivos: `auth-flow.md`, `follow-flow.md`, `reading-flow.md`, `review-flow.md`, `feed-flow.md`, `interactions-flow.md`, `notifications-flow.md`.

## Error Catalog (`docs/error-catalog.md`)

| Campo/seção | Obrigatório | Descrição |
|---|---|---|
| Formato do envelope de erro | sim | `{ error: { code, message, statusCode, details? } }`, com as invariantes (RF-011) |
| Tabela única de `code` | sim | colunas: `code`, HTTP status, classe em `src/errors/*.error.ts`, endpoints onde pode ocorrer, quando acontece |
| Cobertura | sim | 100% das classes em `src/errors/*.error.ts` presentes na tabela (checklist em `quickstart.md`) |

## Viewer Block (`docs/viewer-block.md`)

| Campo/seção | Obrigatório | Descrição |
|---|---|---|
| O que é o bloco `viewer` | sim | explicação de que todo DTO de leitura é resolvido relativo ao usuário autenticado (P6/P14 de `product.md`) |
| Tabela por tipo de recurso | sim | recurso (usuário, livro, review, item de feed, notificação...) × campos de `viewer` presentes × significado de cada um (ex.: `isFollowing`, `followState`, `hasReacted`, `myReadingStatus`) |

## Design Prompt (`docs/design-prompt.md`)

| Campo/seção | Obrigatório | Descrição |
|---|---|---|
| Contexto do produto | sim | 1-2 parágrafos: rede social de leitores, privada por padrão, follow com aprovação — o suficiente para quem só tem o prompt e nunca viu `product.md` |
| Plataforma e diretrizes visuais | sim | web responsivo mobile-first; direção estética aconchegante/literária; apenas tema claro (RF-015, RF-016) |
| Lista das 9 áreas do MVP com telas por área | sim | auth/onboarding, perfil, follow, livros, reading session, review, feed, interações, notificações (RF-014) — nenhuma tela fora dessa lista |
| Regras de negócio que afetam a UI | sim | perfil bloqueado até aprovação, nota estrela cheia 1–5, spoiler como flag visível, review sem texto permitida, feed só de quem segue aprovado (RF-017) |
| Orientação de dados mockados | sim | usar dados fictícios plausíveis (capas, nomes, avatares) já que o Claude Design não acessa a API real (RF-018) |
| Marcação de aprovação | sim | o documento deixa explícito que este é o texto final apresentado para aprovação do usuário (RF-019) — não é rascunho |

**Regra de validação**: apresentado ao usuário nesta feature e aprovado explicitamente antes de a tarefa correspondente ser marcada como concluída.
