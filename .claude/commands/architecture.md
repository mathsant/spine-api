---
description: Detecta (ou define, se o projeto for novo) a arquitetura e as convenções de desenvolvimento do projeto.
---

Argumentos opcionais do usuário (ex.: contexto já dado sobre a stack desejada):
$ARGUMENTS

## Sua tarefa

O objetivo é produzir `.specify/memory/architecture.md` a partir de `.specify/templates/architecture-template.md`, com a estrutura e as convenções que `/plan` e `/tasks` vão seguir dali em diante. Rode isso **uma vez por projeto**, no começo (logo após `/constitution`), e de novo só se a arquitetura mudar de verdade.

**Regra fixa do kit (inegociável)**: código, nomes de arquivos, pastas, identificadores, branches, tabelas/colunas e recursos de infra são sempre em **inglês** — só texto voltado ao usuário final pode estar em português. Isso não é uma convenção a decidir com o usuário: já está no template de `architecture.md` e no princípio "Idioma do código: inglês" da constituição. Se o Passo 2A detectar código existente em português, mantenha a regra, registre os pontos em português na seção "Evidências usadas na detecção" e avise o usuário que são dívida a corrigir.

### Passo 1 — Determine se o projeto já tem código ou está começando do zero

Verifique, além de `.specify/`, `.claude/` e `specs/` (que são do próprio kit): existe `package.json`, `go.mod`, `requirements.txt`/`pyproject.toml`, `Gemfile`, `composer.json`, `*.csproj`, `Cargo.toml`, ou qualquer diretório de código-fonte (`src/`, `app/`, `lib/`, etc.) com arquivos reais dentro? Existe histórico de commits além do commit inicial do kit?

- **Se sim** → siga o Passo 2A (projeto existente).
- **Se não** (projeto novo/vazio) → siga o Passo 2B (projeto novo).

### Passo 2A — Projeto existente: detectar a arquitetura real

1. Leia os arquivos de configuração de stack (`package.json`/`tsconfig.json`/equivalentes) para identificar linguagem, framework, gerenciador de pacotes, ferramentas de lint/teste.
2. Explore a estrutura de diretórios (2-3 níveis) e leia alguns arquivos representativos de cada tipo (um componente/módulo, um serviço, um teste) para entender as convenções reais em uso — não só a estrutura de pastas, mas nomenclatura, padrão de importação, como testes são organizados.
3. Preencha `architecture.md` com o que foi observado, incluindo a seção "Evidências usadas na detecção" listando os arquivos/pastas que embasaram cada conclusão.
4. **Regra crítica — dúvida bloqueia, não assume**: se o código existente for ambíguo ou inconsistente (ex.: parte do projeto usa um padrão, parte usa outro; não fica claro se a organização é por feature ou por camada; convenção de teste não é óbvia), **pare e pergunte ao usuário diretamente na conversa**, quantas vezes for preciso — não infira uma convenção "no chute" e não escolha uma das opções conflitantes sozinho.
5. Antes de gravar o arquivo, mostre um resumo do que foi detectado ao usuário e peça confirmação (é uma inferência sobre código real — errar aqui propaga erro para todo o resto do fluxo SDD). Ajuste conforme o feedback antes de salvar.

### Passo 2B — Projeto novo: definir a arquitetura com o usuário

1. Não existe código pra inferir nada — pergunte. Cubra pelo menos: linguagem/stack principal, framework, tipo de projeto (SPA, API, CLI, mobile, monorepo, etc.), padrão de organização de pastas preferido, convenções de nomenclatura, ferramentas de teste e lint, gerenciador de pacotes.
2. Faça as perguntas **uma de cada vez**, aguardando resposta antes de seguir. Sem limite de perguntas — pare só quando tiver decisões suficientes para preencher `architecture.md` de forma útil e concreta (não genérica).
3. Sempre que uma resposta do usuário for vaga ou abrir uma nova dúvida (ex.: "Vue" sem dizer se é Composition ou Options API, ou se usa Pinia), pergunte de novo até fechar a decisão — mesma regra do `/specify`: não preencha com suposição.

### Passo 3 — Gravar

Preencha `architecture.md` completo, incluindo a tabela "Onde cada tipo de código novo deve ir" com caminhos concretos (não deixe placeholders genéricos) — é essa tabela que `/tasks` vai usar depois para decidir os caminhos de arquivo de cada tarefa.

### Passo 4 — Reportar

Diga ao usuário: se a arquitetura foi detectada ou definida do zero, um resumo das decisões/convenções principais, e que `/plan` e `/tasks` agora vão seguir esse arquivo automaticamente.

Não crie `spec.md`, `plan.md` nem código de implementação neste comando.
