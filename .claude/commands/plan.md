---
description: Gera o plano técnico de implementação (pesquisa, design, contratos) a partir do spec.md da feature atual.
---

Contexto/restrições técnicas adicionais fornecidas pelo usuário (opcional):
$ARGUMENTS

## Sua tarefa

1. Rode:
   ```
   .specify/scripts/bash/setup-plan.sh --json
   ```
   Capture do JSON: `PLAN_FILE`, `SPEC_FILE`, `RESEARCH_FILE`, `DATA_MODEL_FILE`, `QUICKSTART_FILE`, `CONTRACTS_DIR`, `FEATURE_DIR`.

2. Leia `SPEC_FILE`, `.specify/memory/constitution.md` e `.specify/memory/architecture.md`.
   - Se `architecture.md` **não existir**, avise o usuário que rodar `/architecture` primeiro é recomendado (garante que a stack/estrutura seja consistente entre features), mas pode prosseguir: faça você mesmo uma checagem leve do projeto (`package.json`/`go.mod`/estrutura de pastas) e, se houver qualquer ambiguidade sobre a stack ou onde o código deve ir, pergunte ao usuário em vez de assumir.
   - **Design (condicional — só se `design/` existir E a feature tiver UI)**: se a pasta `design/` existir e a feature envolver telas, leia também `design/design-system.md`, `design/components.md`, `design/manifest.md` e os `design/screens/<tela>.md` das telas desta feature (localize-as pela coluna "Feature" do `manifest.md`, preenchida pelo `/specify`). Se `design/` não existir ou a feature não tiver UI, siga sem — como acontece com `architecture.md` quando ausente.

3. Preencha o `PLAN_FILE` (copiado de `.specify/templates/plan-template.md`) seguindo suas próprias seções, na ordem:

   **Contexto Técnico**: preencha cada campo com a stack real do projeto. Se `architecture.md` existir, use-o como fonte da verdade (não reinvente stack/estrutura já decididas ali). Marque `[NEEDS CLARIFICATION]` só onde realmente não dá pra decidir sem o usuário.

   **Estrutura do Projeto**: os caminhos de diretório desta seção devem seguir a tabela "Onde cada tipo de código novo deve ir" de `architecture.md`, quando existir, em vez de uma estrutura genérica. Todo nome de arquivo, pasta, contrato, entidade e identificador citado no plano é em **inglês** (regra fixa do kit — princípio "Idioma do código: inglês" da constituição).

   **Verificação da Constituição**: para cada princípio em `.specify/memory/constitution.md`, avalie se este plano está em conformidade. Se a constituição ainda não foi inicializada (placeholders), pule este gate e avise o usuário para rodar `/constitution`.

   **Fase 0 — Pesquisa**: resolva cada `[NEEDS CLARIFICATION]` restante do Contexto Técnico. Escreva as decisões em `RESEARCH_FILE` (decisão / justificativa / alternativas consideradas).

   **Fase 1 — Design & Contratos**:
   - Escreva `DATA_MODEL_FILE` a partir das Entidades-Chave da spec.
   - Gere contratos de API/interface em `CONTRACTS_DIR/` a partir dos Requisitos Funcionais.
   - Escreva `QUICKSTART_FILE` com os passos manuais para validar a feature.
   - **Mapeamento de telas contra `design/` (só se `design/` existir e a feature tiver UI)**: para cada tela desta feature (as vinculadas no `design/manifest.md`), mapeie a tela a uma rota/página concreta; liste os componentes de `design/components.md` que ela usa, marcando quais já existem no código (reusar) e quais faltam (criar); referencie o `design/screens/<tela>.md` e o `design/tokens.*` como fonte visual — **não** redefina cores, espaçamento ou tipografia à mão no plano. Registre em `research.md` quais telas do catálogo esta feature cobre e qualquer divergência entre o design e a spec (a spec vence; a divergência fica anotada).
   - Rode `.specify/scripts/bash/update-agent-context.sh` para propagar a stack decidida ao `CLAUDE.md` do projeto.

   **Fase 2 — descrição da abordagem de tarefas**: só descreva a estratégia que o `/tasks` vai seguir. **Não gere `tasks.md` neste comando.**

   Repita a Verificação da Constituição após a Fase 1 — se alguma decisão de design violou um princípio, documente a justificativa em "Rastreio de Complexidade" ou reconsidere o design.

4. Marque a seção "Progresso" no fim do `plan.md` conforme cada fase é concluída.

5. Reporte ao usuário: o que foi decidido na pesquisa, quais artefatos foram gerados, e se algum gate da constituição ficou pendente de justificativa.
