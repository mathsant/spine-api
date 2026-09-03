# Arquitetura de better-books

**Origem**: definida interativamente com o usuário (projeto novo, sem código de implementação)
**Última atualização**: 2026-09-03

<!--
Este arquivo é a fonte da verdade sobre COMO o projeto é estruturado.
/plan e /tasks leem este arquivo e devem seguir o que está aqui em vez de
reinventar convenções a cada feature. Se o projeto mudar de arquitetura,
rode /architecture de novo para atualizar este arquivo.
-->

## Stack

- **Linguagem(ns)**: TypeScript 5.x (`strict`, `module: commonjs`, `target: es2016`), rodando em **Node.js v24**.
- **Framework(s) principal(is)**: **Fastify** na camada HTTP; **Awilix** (+ `@fastify/awilix`) para injeção de dependências.
- **Gerenciador de pacotes**: **npm** (`package-lock.json` versionado).
- **Armazenamento/banco**: **MongoDB** via **driver nativo `mongodb`** (sem ODM). Migrations com **`migrate-mongo`**.
- **Validação**: **zod** para toda entrada externa.
- **Testes**: **Vitest**. Unitários: `npm run test:unit`. Integração (regra de negócio, com `mongodb-memory-server`): `npm run test:integration`. Tudo: `npm run test`. Config em `vitest.config.ts` com dois *projects* (unit / integration).
- **Lint/format**: **ESLint + Prettier**.

## Tipo de projeto e padrão arquitetural

**Monolito** (processo único, API HTTP) organizado em **camadas com fluxo unidirecional**:

```
controller (HTTP / Fastify)  →  service (regra de negócio)  →  repository (acesso a dados)
```

- O **controller** só lida com HTTP: valida a entrada com zod, resolve o service do container e traduz o resultado/erro em resposta. Nunca fala com o driver do MongoDB nem com um repository direto.
- O **service** contém a regra de negócio. Depende de **interfaces** de repository resolvidas pelo cradle do Awilix — nunca instancia implementação concreta. Não importa tipos do Fastify.
- O **repository** é o único lugar onde o driver `mongodb` aparece. Exposto como **interface** + **implementação** (`mongo-*`). Captura exceções cruas do driver e as converte em erros de domínio.

Injeção de dependências via **Awilix** com factory functions registradas por `asFunction`. Cada operação é uma factory: `makeCreateBookService = (deps) => async (input) => { ... }`.

## Estrutura de diretórios

```
better-books/
├── src/
│   ├── server.ts                 # entrypoint: carrega config e chama app.listen()
│   ├── app.ts                    # monta a instância Fastify, registra plugins (awilix, rotas por domínio)
│   ├── config/                   # parsing/validação de env com zod
│   │   └── env.ts
│   ├── container/                # registros do Awilix (composition root)
│   │   ├── register-repositories.ts
│   │   ├── register-services.ts
│   │   └── index.ts
│   ├── db/                       # conexão com o MongoDB
│   │   └── mongo-client.ts
│   ├── controllers/             # camada HTTP — 1 plugin de rotas por domínio + 1 handler por operação
│   │   └── books/
│   │       ├── books.routes.ts          # plugin Fastify: registra as rotas do domínio
│   │       ├── create-book.controller.ts # handler puro (request, reply) => ...
│   │       ├── get-book.controller.ts
│   │       └── index.ts                  # re-exports nomeados
│   ├── services/               # camada de regra de negócio — 1 arquivo por operação (factory Awilix)
│   │   └── books/
│   │       ├── create-book.service.ts
│   │       ├── get-book.service.ts
│   │       └── index.ts
│   ├── repositories/           # camada de acesso a dados — interface + implementação Mongo
│   │   └── books/
│   │       ├── book.repository.ts        # a interface
│   │       ├── mongo-book.repository.ts  # implementação com o driver mongodb
│   │       └── index.ts
│   ├── schemas/                # schemas zod de entrada externa — 1 por operação
│   │   └── books/
│   │       ├── create-book.schema.ts
│   │       └── index.ts
│   └── errors/                 # tipo de erro base + erros de domínio
│       ├── app-error.ts        # o tipo base que todos os erros de domínio estendem
│       ├── book-not-found.error.ts
│       └── index.ts
├── tests/
│   ├── unit/                   # espelha src/ — testes unitários das funções que NÃO são regra de negócio
│   │   ├── schemas/books/create-book.schema.spec.ts
│   │   └── errors/app-error.spec.ts
│   └── integration/           # espelha src/ — regra de negócio com mongodb-memory-server (sem mock de banco)
│       └── services/books/create-book.service.spec.ts
├── migrations/                 # scripts do migrate-mongo (gerados por `npx migrate-mongo create`)
├── migrate-mongo-config.js
├── vitest.config.ts
├── package.json
└── tsconfig.json
```

Regra transversal: **cada pasta de domínio dentro de uma camada tem um `index.ts`** que reexporta os membros públicos. Imports entre camadas passam pelo `index.ts` da pasta, não por caminhos profundos.

## Convenções de nomenclatura

- **Idioma (regra fixa do kit — não editável)**: todo nome de arquivo, pasta, identificador de código, branch, coleção/campo/índice, chave de config e recurso de infra é em **inglês**. Ver o princípio "Idioma do código: inglês" em `.specify/memory/constitution.md`. Português só em texto voltado ao usuário final.
- **Arquivos e pastas**: **kebab-case** (`create-book.service.ts`, `repositories/books/`).
- **Sufixo por camada no nome do arquivo**: `*.controller.ts`, `*.service.ts`, `*.repository.ts`, `*.schema.ts`, `*.error.ts`, `*.routes.ts`.
- **Granularidade**: **um arquivo por operação** nas camadas de controller e service (`create-book.service.ts`, `get-book.service.ts`), não um arquivo agregando o domínio.
- **Repository**: interface em `<domain>.repository.ts`; implementação com prefixo da tecnologia em `mongo-<domain>.repository.ts`.
- **Exports**: **sempre nomeados**. **Nenhum `export default`** em nenhum arquivo. Cada pasta de domínio expõe `index.ts` com re-exports nomeados.
- **Factories de service**: `makeXxxService` (ex.: `makeCreateBookService`); nome de registro no Awilix em camelCase (`createBookService`, `bookRepository`).
- **Testes**: arquivos `*.spec.ts` sob `tests/unit/**` ou `tests/integration/**`, espelhando o caminho em `src/`.
- **Migrations**: geradas pelo `migrate-mongo` (timestamp + descrição em inglês, ex.: `20260903120000-create-books-collection.js`).
- **Branches**: `###-feature-name` em inglês (convenção do spec kit).

## Onde cada tipo de código novo deve ir

*Esta seção é a referência direta que `/tasks` usa para decidir o caminho de arquivo de cada tarefa.*

| Tipo de código | Caminho | Exemplo |
|---|---|---|
| Plugin de rotas HTTP (por domínio) | `src/controllers/<domain>/<domain>.routes.ts` | `src/controllers/books/books.routes.ts` |
| Handler HTTP (uma operação) | `src/controllers/<domain>/<verb>-<domain>.controller.ts` | `src/controllers/books/create-book.controller.ts` |
| Regra de negócio (uma operação) | `src/services/<domain>/<verb>-<domain>.service.ts` | `src/services/books/create-book.service.ts` |
| Interface de repository | `src/repositories/<domain>/<domain>.repository.ts` | `src/repositories/books/book.repository.ts` |
| Implementação de repository (Mongo) | `src/repositories/<domain>/mongo-<domain>.repository.ts` | `src/repositories/books/mongo-book.repository.ts` |
| Schema zod de entrada | `src/schemas/<domain>/<verb>-<domain>.schema.ts` | `src/schemas/books/create-book.schema.ts` |
| Erro de domínio | `src/errors/<name>.error.ts` | `src/errors/book-not-found.error.ts` |
| Tipo de erro base | `src/errors/app-error.ts` | `src/errors/app-error.ts` (único) |
| Registro no container (DI) | `src/container/register-*.ts` | `src/container/register-services.ts` |
| Conexão com o MongoDB | `src/db/` | `src/db/mongo-client.ts` |
| Config / env | `src/config/` | `src/config/env.ts` |
| Migration | `migrations/` (via `npx migrate-mongo create <name>`) | `migrations/20260903120000-create-books-collection.js` |
| Teste unitário (função não-regra-de-negócio) | `tests/unit/**` espelhando `src/` | `tests/unit/schemas/books/create-book.schema.spec.ts` |
| Teste de integração (regra de negócio) | `tests/integration/**` espelhando `src/` | `tests/integration/services/books/create-book.service.spec.ts` |
| Índice de pasta de domínio | `src/<layer>/<domain>/index.ts` | `src/services/books/index.ts` |

## Padrões a seguir

- **Código, arquivos e pastas sempre em inglês** (regra fixa do kit — inegociável).
- **Fluxo unidirecional**: controller → service → repository. Um controller nunca importa um repository nem o driver `mongodb`; um service nunca importa tipos do Fastify.
- **Entrada externa validada com zod no controller** (ou em `preValidation` do Fastify) antes de chamar o service. O service recebe dados já validados e tipados a partir do schema.
- **Services dependem de interfaces de repository resolvidas do cradle do Awilix** — nunca `new MongoBookRepository()` dentro de um service.
- **O driver `mongodb` só aparece em `src/repositories/**` e `src/db/**`.** O repository captura exceção crua do driver e a converte em erro que estende `AppError` (`src/errors/app-error.ts`).
- **Imports entre camadas passam pelo `index.ts`** da pasta de domínio, não por caminhos profundos.
- **Mudança de coleção/índice/backfill só via migration `migrate-mongo`.** Nada de `createIndex` no bootstrap da aplicação.
- **Regra de negócio é testada com `mongodb-memory-server`** (Mongo real em memória), sem mockar o banco; cobertura ≥ 70%, caminho feliz + ≥1 caminho de erro. Demais funções: teste unitário isolado.

## Padrões a evitar

- Não usar `any` nem `as` para silenciar o compilador (`strict` está ligado).
- Não colocar regra de negócio em controller ou repository.
- Não importar `mongodb` fora de `src/repositories/**` e `src/db/**`.
- Nenhum `export default`; não fazer import profundo que fure o `index.ts` da pasta de domínio.
- Não mockar o MongoDB em teste de regra de negócio — usar `mongodb-memory-server`.
- Não deixar exceção crua do driver vazar do repository para cima.
- Não agregar várias operações num único arquivo de service/controller.

## Evidências usadas na detecção

*Projeto novo — arquitetura definida interativamente com o usuário, não detectada de código. Base factual usada nas decisões:*

- `package.json` (npm, `"private": true`, sem dependências ainda), `package-lock.json` presente.
- `tsconfig.json` (`strict`, `module: commonjs`, `target: es2016`, `outDir: dist`, `include: ["src"]`).
- `src/index.ts` vazio; nenhum commit no repositório.
- `.specify/memory/constitution.md` v1.0.0 (testes por tipo de código, repositório com interface + implementação, zod na borda, migrations, erros tipados a partir de um tipo base).
- Decisões do usuário nesta sessão: monolito em camadas controller→service→repository; Fastify + Node.js v24; driver `mongodb` nativo + `migrate-mongo`; Vitest; ESLint + Prettier; organização por camada com subpastas por domínio + `index.ts` e exports nomeados; kebab-case com sufixo de camada, um arquivo por operação; Awilix (`@fastify/awilix`) com factory functions; `tests/` espelhando `src/`, integração em pasta própria; um plugin de rotas Fastify por domínio; `src/app.ts` + `src/server.ts` como bootstrap.
