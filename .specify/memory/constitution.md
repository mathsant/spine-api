# Constituição de better-books

<!--
SYNC IMPACT REPORT (preenchido pelo /constitution a cada alteração)
Versão: 0.0.0 → 1.0.0
Alteração: criação inicial — placeholders substituídos.
Princípios adicionados:
  - Testes por tipo de código (integração com mongodb-memory-server / unitário)
  - Acesso a dados exclusivamente via repositório (interface + implementação)
  - Validação de entrada com Zod na borda
  - Mudança de schema/índice apenas via migration
  - Erros tipados com hierarquia a partir de um tipo base
Princípio fixo do kit mantido: "Idioma do código: inglês".
Restrições Adicionais: definidas (stack de testes e validação).
Fluxo de Desenvolvimento: definido (gate de testes e cobertura).
Templates que podem precisar de revisão:
  - plan-template.md → seção "Verificação da Constituição" ainda usa "Princípio [N]" genérico;
    recomenda-se listar os 5 princípios reais (ver relatório ao usuário).
  - spec-template.md → sem impacto.
  - tasks-template.md → sem impacto direto; ordenação TDD já compatível.
-->

## Princípios Centrais

### Idioma do código: inglês (regra fixa do kit — não editável)

Todo artefato técnico do projeto é escrito em **inglês**, sem exceção: nomes de arquivos e pastas, identificadores de código (variáveis, funções, classes, métodos, constantes, tipos, módulos, pacotes), nomes de branch, nomes de tabela/coluna/índice, chaves de configuração e de tradução, nomes de recursos de infra, mensagens de commit e comentários no código.

Português (ou outro idioma) é permitido **apenas** em conteúdo voltado ao usuário final (textos de interface, mensagens exibidas, documentação de produto) e na documentação do fluxo SDD em si (`spec.md`, `plan.md`, `tasks.md` e afins continuam em português).

**Justificativa**: mantém a base de código consistente, legível por qualquer ferramenta e colaborador, e evita mistura de idiomas em identificadores — que é fonte recorrente de bugs de digitação e de convenção. Esta regra vem do kit e vale para todo projeto; `/constitution` não deve removê-la nem transformá-la em placeholder. Se um projeto específico precisar de exceção, ela deve ser documentada explicitamente na seção "Restrições Adicionais" com justificativa.

### Testes por tipo de código

Cada função nasce com o tipo de teste que corresponde à sua natureza:

- **Regra de negócio** (lógica de domínio que lê ou escreve dados, ou orquestra repositórios): coberta por **teste de integração** que roda contra uma instância real de MongoDB em memória via `mongodb-memory-server`. O banco **não** é mockado nesses testes.
- **Demais funções** (puras, utilitárias, mapeadores, validadores, helpers sem I/O): cobertas por **teste unitário isolado**, sem subir banco.

A cobertura de testes das regras de negócio deve ser de **no mínimo 70%**, e cada regra de negócio testada cobre o caminho feliz **e** pelo menos um caminho de erro.

**Justificativa**: regras de negócio dependem do comportamento real do MongoDB — filtros, índices, agregações, upserts, unicidade, ordenação. Mockar o driver esconde exatamente as falhas que importam. Já funções puras não justificam o custo de subir o banco: teste unitário dá o mesmo sinal mais rápido. O piso de 70% e a exigência de um caminho de erro evitam a "cobertura de fachada" que só exercita o caminho feliz.

### Acesso a dados exclusivamente via repositório

Todo acesso ao MongoDB passa por uma camada de **repositório**, definida como **interface** e consumida por essa interface. As **implementações** concretas (que falam com o driver) ficam separadas das interfaces e são injetadas. Serviços, handlers e regras de negócio **nunca** importam ou chamam o driver do MongoDB diretamente.

**Justificativa**: isola a regra de negócio da tecnologia de persistência, permite trocar/decorar a implementação (cache, métricas, fakes) sem tocar no domínio, e é o que torna viável testar com `mongodb-memory-server` de um lado e stubs do outro. Depender da interface, não da implementação, mantém as dependências apontando para dentro.

### Validação de entrada com Zod na borda

Toda entrada vinda de fora do processo (payload HTTP, mensagem de fila, parâmetros de job, variáveis de ambiente relevantes) é validada por um **schema `zod`** na borda, antes de alcançar qualquer regra de negócio. A regra de negócio recebe apenas dados já validados e tipados a partir do schema.

**Justificativa**: centraliza a validação num ponto único e verificável, elimina checagens defensivas espalhadas pelo domínio, e garante que os tipos em runtime batem com os tipos de compilação. `zod` é a lib padrão do projeto para isso — não misturar com validação manual ad hoc.

### Mudança de schema/índice apenas via migration

Qualquer alteração na estrutura de dados persistida — criação/remoção de coleção, criação/alteração/remoção de índice, backfill ou transformação de documentos existentes — é feita por uma **migration versionada** e reversível. É proibido criar índice "no ar" (via shell, código de bootstrap não rastreado, ou manualmente no Atlas) sem a migration correspondente.

**Justificativa**: torna o estado do banco reproduzível entre ambientes e rastreável no histórico, evita divergência entre dev/produção, e permite revisar o impacto de um índice (custo de escrita, unicidade) antes de aplicá-lo.

### Erros tipados com hierarquia a partir de um tipo base

O projeto define **um tipo de erro base** único. Todos os erros de domínio são tipos **customizados que estendem esse tipo base**. Regras de negócio sinalizam falha com esses tipos conhecidos; exceção crua do driver do MongoDB (ou de qualquer lib de infra) **não vaza** para a borda — é capturada e traduzida para um erro do domínio.

**Justificativa**: dá à borda um contrato estável para mapear erro → resposta (status HTTP, código, mensagem), permite `instanceof` confiável e tratamento exaustivo, e impede que detalhes de infraestrutura (mensagens do driver, stack traces internos) escapem para o consumidor.

## Restrições Adicionais

- **Stack de testes**: `mongodb-memory-server` para integração de regra de negócio. A escolha do runner (Vitest/Jest) é decisão de `/architecture`, mas o mecanismo de Mongo em memória é inegociável.
- **Validação**: `zod` é a única biblioteca de validação de entrada do projeto.
- **Persistência**: MongoDB é o armazenamento primário; o acesso é sempre intermediado por repositórios (ver princípio correspondente).
- Nenhuma dependência nova sem justificativa registrada em `research.md`.

## Fluxo de Desenvolvimento

Além do fluxo SDD padrão, todo PR/plano deve confirmar antes do merge:

1. Regras de negócio novas ou alteradas têm teste de integração com `mongodb-memory-server` (caminho feliz + ≥1 caminho de erro).
2. Funções não-regra-de-negócio novas ou alteradas têm teste unitário.
3. Cobertura de regra de negócio ≥ 70%.
4. Nenhum acesso ao driver do MongoDB fora de uma implementação de repositório.
5. Entradas externas novas passam por schema `zod`.
6. Mudanças de schema/índice acompanham migration.
7. Erros novos estendem o tipo de erro base do projeto.

## Governança

Esta constituição tem precedência sobre qualquer outra prática do projeto. Alterações exigem:

1. Documentação da mudança e justificativa.
2. Atualização do Sync Impact Report no topo deste arquivo.
3. Verificação de que `plan-template.md` ainda reflete os princípios vigentes (seção "Verificação da Constituição").

Toda revisão de PR/plano deve confirmar conformidade com estes princípios. Complexidade não justificada deve ser rejeitada ou documentada em "Rastreio de Complexidade" no `plan.md`.

**Versão**: 1.0.0 | **Ratificada em**: 2026-09-03 | **Última alteração**: 2026-09-03
