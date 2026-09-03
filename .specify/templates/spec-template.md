# Especificação de Feature: [NOME DA FEATURE]

**Branch**: `[###-nome-da-feature]`
**Criado em**: [DATA]
**Status**: Rascunho
**Entrada**: descrição original do usuário: "$ARGUMENTS"

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

## Cenários de Usuário & Testes *(obrigatório)*

### História principal

[Descreva em 2-4 frases a jornada do usuário que esta feature resolve.]

### Cenários de aceitação

1. **Dado** [contexto inicial], **quando** [ação], **então** [resultado esperado].
2. **Dado** [contexto inicial], **quando** [ação], **então** [resultado esperado].

### Casos de borda

- O que acontece quando [condição de fronteira]?
- Como o sistema lida com [cenário de erro]?

## Requisitos *(obrigatório)*

### Requisitos funcionais

- **RF-001**: O sistema DEVE [capacidade específica, ex.: "permitir que usuários criem conta"].
- **RF-002**: O sistema DEVE [capacidade específica].
- **RF-003**: Usuários DEVEM ser capazes de [interação-chave].
- **RF-004**: O sistema DEVE [requisito de dados, ex.: "validar endereços de e-mail"].
- **RF-005**: O sistema DEVE [comportamento, ex.: "registrar eventos de auditoria"].

*Marque requisitos ambíguos, por exemplo:*
- **RF-006**: O sistema DEVE autenticar usuários via [NEEDS CLARIFICATION: método de auth não especificado — e-mail/senha? SSO? magic link?].

### Entidades-chave *(se a feature envolve dados)*

*Nomeie cada entidade e atributo em inglês (regra fixa do kit — vira identificador no código); a descrição fica em português.*

- **[Entity 1]**: o que representa, atributos-chave (sem detalhes de schema), relações com outras entidades.
- **[Entity 2]**: [...]

---

## Definição de Pronto (Definition of Done) *(obrigatório)*

*Resposta do usuário à pergunta feita pelo `/specify`: quais pontos são primordiais para considerar isto DONE? Vale para qualquer tipo de spec — feature, correção de bug, análise, validação, etc. Cada item deve ser verificável objetivamente (não "funcionar bem"), e vira referência direta para o `/implement` confirmar conclusão no final.*

- [ ] [critério 1, ex.: "usuário consegue completar o cadastro sem erro em todos os cenários de aceitação acima"]
- [ ] [critério 2, ex.: "cobertura de teste automatizado no fluxo principal"]
- [ ] [critério 3, ex.: "nenhuma regressão nos fluxos existentes de login"]

---

## Esclarecimentos

*Preenchido pelo comando `/clarify`. Cada rodada adiciona uma subseção com data.*

### Sessão [DATA]

- P: [pergunta] → R: [resposta]

---

## Checklist de Revisão

*Gate automatizado verificado pelo `/specify` e revisado por `/clarify` antes do `/plan`.*

### Qualidade do conteúdo

- [ ] Sem detalhes de implementação (linguagens, frameworks, APIs)
- [ ] Focado em valor para o usuário e necessidades de negócio
- [ ] Escrito para stakeholders não-técnicos
- [ ] Todas as seções obrigatórias preenchidas

### Completude dos requisitos

- [ ] Nenhum marcador `[NEEDS CLARIFICATION]` remanescente
- [ ] Requisitos são testáveis e não-ambíguos
- [ ] Critérios de sucesso são mensuráveis
- [ ] Escopo está claramente delimitado
- [ ] Dependências e premissas identificadas
- [ ] Definição de Pronto preenchida, com critérios objetivos e verificáveis (não vagos)
