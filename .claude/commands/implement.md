---
description: Executa as tarefas de tasks.md da feature atual, respeitando ordem e paralelismo.
---

Argumentos opcionais do usuário (ex.: rodar só até uma tarefa específica):
$ARGUMENTS

## Sua tarefa

1. Rode:
   ```
   .specify/scripts/bash/check-prerequisites.sh --json --require-tasks --include-tasks
   ```
   Se `tasks.md` não existir, avise o usuário para rodar `/tasks` primeiro.

2. Leia `tasks.md` completo, mais `plan.md`, `data-model.md`, `contracts/*` e a seção "Definição de Pronto (Definition of Done)" de `spec.md` como referência de design e de critério final de conclusão.
   - Se alguma tarefa citar um arquivo de `design/` (ou o `plan.md` referenciar essa pasta), leia os `design/screens/<tela>.md` e trechos de `design/components.md` correspondentes, mais `design/tokens.*`, **antes** de executar a tarefa de UI que depende deles.
   - **Regra**: a spec vence o design em comportamento. Se o arquivo de design contradisser um requisito da spec, implemente conforme a spec e reporte a divergência ao usuário em vez de resolver por conta própria.

   - **Regra fixa do kit (inegociável)**: todo código que você escrever — nomes de arquivos, pastas, variáveis, funções, classes, tipos, constantes, branches, migrations, tabelas/colunas, comentários e mensagens de commit — é em **inglês**. Só strings/textos exibidos ao usuário final podem estar em português. Ver o princípio "Idioma do código: inglês" em `.specify/memory/constitution.md`.

3. Execute as tarefas na ordem definida em "Dependências":
   - Respeite a ordem TDD: escreva e rode o teste da tarefa antes de implementar o código que o satisfaz, quando a tarefa for de teste.
   - Tarefas marcadas `[P]` sem dependência pendente entre si podem ser feitas em qualquer ordem relativa, mas ainda sequencialmente por você (não gere código conflitante).
   - Depois de completar cada tarefa, marque o checkbox correspondente em `tasks.md` (`- [ ]` → `- [x]`).

4. Se uma tarefa falhar (teste não passa, erro de build) ou depender de uma decisão não coberta pela spec/plano:
   - Pare de avançar para as tarefas seguintes que dependem dela.
   - Reporte o bloqueio ao usuário com o erro real, em vez de assumir uma solução não especificada.

5. Ao final (ou ao atingir o ponto pedido pelo usuário), confira cada item da "Definição de Pronto" do `spec.md` contra o que foi de fato implementado/verificado — não marque um item como atendido sem confirmar (rodando o teste correspondente, checando o comportamento, etc.).

6. Reporte: quantas tarefas foram concluídas, quais ficaram pendentes/bloqueadas e por quê, o status de cada item da Definição de Pronto (atendido / pendente / não verificável ainda), e sugira rodar os testes completos do projeto para confirmar o estado.

Não pule etapas de teste "pra ir mais rápido" — a ordem TDD do `tasks.md` existe para garantir que a implementação seja verificável.
