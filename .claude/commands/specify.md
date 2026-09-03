---
description: Cria a especificação de uma nova feature a partir de uma descrição em linguagem natural.
---

Descrição da feature fornecida pelo usuário:
$ARGUMENTS

## Sua tarefa

1. A partir da descrição do usuário, componha um **slug curto em inglês** (2-4 palavras, minúsculas, sem acento) que resuma a feature — nome de branch e de pasta são sempre em inglês (regra fixa do kit). Ex.: descrição "cadastro de consumo de energia" → slug `energy-consumption-signup`. Então rode:
   ```
   .specify/scripts/bash/create-new-feature.sh --json --slug "<slug-em-ingles>" "$ARGUMENTS"
   ```
   Isso cria a branch `NNN-slug-em-ingles`, o diretório `specs/NNN-slug-em-ingles/` e um `spec.md` a partir do template. Capture do JSON de saída: `BRANCH_NAME`, `SPEC_FILE`, `FEATURE_DIR`.

2. Leia o `SPEC_FILE` recém-criado (é uma cópia de `.specify/templates/spec-template.md`).

3. Preencha o `spec.md` a partir da descrição do usuário, seguindo o "Fluxo de execução" descrito no próprio template:
   - Extraia atores, ações, dados, restrições.
   - Escreva a história principal e os cenários de aceitação no formato Dado/Quando/Então.
   - Escreva Requisitos Funcionais testáveis (RF-001, RF-002, ...).
   - Identifique Entidades-Chave, se aplicável.
   - Mantenha o foco em O QUÊ/POR QUÊ. Nada de stack, frameworks, nomes de tabela — isso é papel do `/plan`.
   - O `spec.md` é redigido em português (é documento do fluxo, não código). Mas qualquer identificador técnico que a spec introduza — nome de entidade, campo, evento, estado — já deve ser nomeado em **inglês**, para bater com a regra fixa do kit ("Idioma do código: inglês", na constituição) quando `/plan` e `/implement` transformarem isso em código.

4. **Regra crítica — dúvida bloqueia, não marca e segue**: este é o momento mais importante do fluxo SDD. Sempre que você tiver qualquer dúvida real sobre o que a feature deve fazer (ambiguidade de comportamento, escopo indefinido, requisito que admite mais de uma interpretação, regra de negócio não dada), **pare e pergunte ao usuário diretamente na conversa**, uma pergunta por vez, e espere a resposta antes de continuar escrevendo a spec.
   - Não existe limite de perguntas — se surgirem 10 dúvidas reais, faça as 10. Preferir poucas perguntas nunca é motivo para assumir uma resposta.
   - Não use `[NEEDS CLARIFICATION: ...]` como forma de "seguir em frente apesar da dúvida" — use a pergunta direta na conversa como primeira linha de ação. O marcador só deve aparecer no `spec.md` se, excepcionalmente, o usuário pedir explicitamente para deixar algo em aberto para decidir depois.
   - Depois de cada resposta, incorpore-a imediatamente no requisito/cenário afetado e continue preenchendo a spec.
   - Só considere a spec pronta quando não houver mais nenhuma dúvida real sua sobre o comportamento esperado.

5. **Pergunta obrigatória — Definição de Pronto (DoD)**: independente do tipo de spec (feature nova, correção de bug, análise, validação, spike, etc.), sempre pergunte ao usuário algo como: *"quais pontos são primordiais para considerar isto DONE?"* Essa pergunta é obrigatória em **toda** spec — diferente do passo 4, não depende de você ter uma dúvida; faça-a sempre, mesmo que a spec pareça simples ou óbvia.
   - Se a resposta vier vaga ou não-verificável (ex.: "funcionar bem", "estar completo", "ficar redondo"), não aceite — peça algo objetivo e checável, na mesma lógica do passo 4.
   - Registre a resposta na seção "Definição de Pronto (Definition of Done)" do `spec.md`, como uma checklist de itens concretos (não precisa ser um espelho 1:1 dos Requisitos Funcionais — pode incluir coisas como "sem regressão no fluxo de login", "documentação atualizada", "aprovado por [pessoa/critério]", conforme o que o usuário apontar como essencial).
   - Essa checklist é a referência que o `/implement` usa no final para confirmar se a spec está realmente concluída.

6. Rode o checklist de revisão no fim do template. Se algo não bater (detalhe de implementação vazou, requisito não-testável, DoD vago ou ausente), corrija antes de terminar.

7. **Vínculo com o design (condicional — só se `design/` existir E a feature tiver UI)**: se `design/manifest.md` existir e esta feature envolver telas/interface, identifique no catálogo (`design/manifest.md`) quais telas a feature realiza e grave o vínculo nos dois lados:
   - Na tabela "Telas" de `design/manifest.md`, preencha a coluna "Feature" de cada tela realizada por esta feature com o `BRANCH_NAME`.
   - Em cada `design/screens/<tela>.md` correspondente, preencha a seção "Feature relacionada" com o `BRANCH_NAME`.
   - **Não** copie layout, tokens, cores ou detalhes visuais para o `spec.md` — o design continua sendo referência à parte; o `spec.md` só descreve comportamento. O design nunca sobrepõe a spec: se algo no design contradisser um requisito, a spec vence e a divergência deve ser anotada.
   - Se `design/` não existir ou a feature não tiver UI, pule este passo sem comentar.

8. Reporte ao usuário: branch criada, caminho do spec.md, um resumo das decisões tomadas nas perguntas feitas, a Definição de Pronto registrada e — se o passo 7 se aplicou — quais telas do catálogo foram vinculadas a esta feature. A spec só deve chegar a este ponto sem `[NEEDS CLARIFICATION]` pendente — se algum ficou (por pedido explícito do usuário), avise que `/clarify` pode ser rodado depois para revisitá-lo. Caso contrário, já pode seguir direto para `/plan`.

Não crie `plan.md` nem toque em código de implementação neste comando.
