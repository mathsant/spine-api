# Arquitetura de [NOME DO PROJETO]

**Origem**: [detectada automaticamente a partir do código existente / definida interativamente com o usuário]
**Última atualização**: [DATA]

<!--
Este arquivo é a fonte da verdade sobre COMO o projeto é estruturado.
/plan e /tasks leem este arquivo e devem seguir o que está aqui em vez de
reinventar convenções a cada feature. Se o projeto mudar de arquitetura,
rode /architecture de novo para atualizar este arquivo.
-->

## Stack

- **Linguagem(ns)**: [ex.: TypeScript 5.x]
- **Framework(s) principal(is)**: [ex.: Vue 3 + Vite]
- **Gerenciador de pacotes**: [ex.: pnpm]
- **Armazenamento/banco**: [se aplicável, senão N/A]
- **Testes**: [framework e como rodar, ex.: Vitest via `npm run test`]
- **Lint/format**: [ferramentas usadas, ex.: ESLint + Prettier]

## Tipo de projeto e padrão arquitetural

[ex.: SPA single-page com Vue 3 Composition API, organização feature-based / monorepo com pnpm workspaces / API REST em camadas (controller-service-repository) / etc. Descreva em termos concretos, não genéricos.]

## Estrutura de diretórios

```
[árvore real de diretórios relevante, com uma linha de comentário por pasta explicando o propósito]
```

## Convenções de nomenclatura

- **Idioma (regra fixa do kit — não editável)**: todo nome de arquivo, pasta, identificador de código, branch, tabela/coluna, chave de config e recurso de infra é em **inglês**. Ver o princípio "Idioma do código: inglês" em `.specify/memory/constitution.md`. Português só em texto voltado ao usuário final.
- **Componentes/módulos**: [ex.: PascalCase, um por arquivo, `ComponentName.vue`]
- **Testes**: [ex.: `name.spec.ts` ao lado do arquivo testado]
- **Outros**: [ex.: composables em `useSomething.ts`, stores em `somethingStore.ts`]

## Onde cada tipo de código novo deve ir

*Esta seção é a referência direta que `/tasks` usa para decidir o caminho de arquivo de cada tarefa.*

| Tipo de código | Caminho | Exemplo |
|---|---|---|
| [ex.: componente de UI] | `[caminho]` | `[exemplo de arquivo real]` |
| [ex.: chamada de API/serviço] | `[caminho]` | `[exemplo]` |
| [ex.: teste] | `[caminho]` | `[exemplo]` |
| [ex.: rota/página] | `[caminho]` | `[exemplo]` |

## Padrões a seguir

- **Código, arquivos e pastas sempre em inglês** (regra fixa do kit — inegociável). Se o código existente tiver identificadores/arquivos em português, registre isso em "Evidências usadas na detecção" e sinalize ao usuário como dívida a corrigir; não normalize para português.
- [ex.: toda chamada HTTP passa por `src/api/client.ts`, nunca `fetch` direto no componente]

## Padrões a evitar

- [ex.: não usar `any` em TypeScript; não misturar Options API com Composition API]

## Evidências usadas na detecção

*Preenchido só quando a arquitetura foi detectada a partir de código existente — lista os arquivos/pastas inspecionados para chegar nas conclusões acima, para facilitar auditoria se algo estiver errado.*

- [ex.: `package.json`, `src/`, `tests/`, `README.md`]
