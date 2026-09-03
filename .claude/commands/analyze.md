---
description: Checagem de consistência somente-leitura entre spec.md, plan.md e tasks.md da feature atual.
---

Argumentos opcionais do usuário:
$ARGUMENTS

## Sua tarefa

Este comando é **somente-leitura**: reporta problemas, não corrige nada automaticamente.

1. Rode:
   ```
   .specify/scripts/bash/check-prerequisites.sh --json --require-tasks --include-tasks
   ```
   Isso falha se `spec.md`, `plan.md` ou `tasks.md` estiverem faltando — nesse caso, avise qual comando rodar antes (`/specify`, `/plan` ou `/tasks`).

2. Leia os três arquivos (`spec.md`, `plan.md`, `tasks.md`) e, se existirem, `data-model.md` e `contracts/*`.

3. Verifique e reporte, organizado por severidade:

   **Crítico** (bloqueia `/implement`):
   - Requisito funcional da spec sem nenhuma tarefa correspondente em `tasks.md`.
   - Tarefa em `tasks.md` que não rastreia a nenhum requisito, entidade ou contrato.
   - `[NEEDS CLARIFICATION]` ainda presente em `spec.md` ou `plan.md`.
   - Violação de princípio da constituição sem justificativa em "Rastreio de Complexidade".

   **Aviso** (não bloqueia, mas deveria ser revisado):
   - Duas tarefas marcadas `[P]` que escrevem no mesmo arquivo.
   - Entidade em `data-model.md` sem nenhuma tarefa de modelo.
   - Cenário de aceitação da spec sem teste de integração correspondente em `tasks.md`.
   - Item da "Definição de Pronto" do `spec.md` sem nenhuma tarefa em `tasks.md` que o satisfaça (ex.: DoD pede "sem regressão no login" mas não há tarefa de teste de regressão).

   **Info**:
   - Inconsistências terminológicas entre os documentos (mesmo conceito com nomes diferentes).

4. Apresente o relatório como uma lista, cada item com: arquivo:seção afetada, descrição do problema, sugestão de correção. Não edite os arquivos.

5. Ao final, pergunte ao usuário se quer que você aplique as correções sugeridas (aí sim editando os arquivos) ou se prefere revisar manualmente primeiro.
