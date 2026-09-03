# Tarefas: [NOME DA FEATURE]

**Entrada**: `plan.md`, `data-model.md`, `contracts/`, `quickstart.md` de `specs/[###-nome-da-feature]/`
**Convenção**: `[P]` = pode rodar em paralelo (arquivos diferentes, sem dependência entre si). Sem `[P]` = sequencial (mesma área de arquivo ou depende de outra tarefa).

Cada tarefa referencia o(s) caminho(s) de arquivo exato(s) a criar/editar.

**As fases abaixo (3.1-3.5) são um esqueleto de exemplo, não um formato fixo.** O `/tasks` deve substituí-las por fases coerentes com a feature real — nomeadas pelo marco que entregam (ex.: "Fase 1: Autenticação básica", "Fase 2: Recuperação de senha"), mantendo a ordem TDD dentro de cada uma. Use este esqueleto como está só quando ele já for a divisão mais coerente para a feature.

## Fase 3.1: Setup

- [ ] T001 Criar estrutura de projeto/diretórios conforme `plan.md`
- [ ] T002 Inicializar dependências e ferramentas de configuração (linter, formatter)
- [ ] T003 [P] Configurar lint/format se ainda não existir

## Fase 3.2: Testes primeiro (TDD) ⚠️ DEVEM ser escritos e FALHAR antes da Fase 3.3

*Regra crítica: cada teste abaixo deve existir e falhar antes de qualquer código de implementação correspondente.*

- [ ] T004 [P] Teste de contrato para [endpoint/interface 1] em `[caminho do teste]`
- [ ] T005 [P] Teste de contrato para [endpoint/interface 2] em `[caminho do teste]`
- [ ] T006 [P] Teste de integração para [cenário de user story 1] em `[caminho do teste]`

## Fase 3.3: Implementação Core (somente após os testes acima estarem falhando)

- [ ] T007 [P] Modelo [Entidade 1] em `[caminho]`
- [ ] T008 [P] Modelo [Entidade 2] em `[caminho]`
- [ ] T009 Serviço [Nome] em `[caminho]` (depende de T007/T008)
- [ ] T010 Endpoint/handler [Nome] em `[caminho]` (depende de T009)
- [ ] T011 Validação de entrada e tratamento de erro para [Nome]

## Fase 3.4: Integração

- [ ] T012 Conectar [Serviço] ao armazenamento/dependências externas
- [ ] T013 Logging/observabilidade, se aplicável
- [ ] T014 Middleware/CORS/auth, se aplicável

## Fase 3.5: Polimento

- [ ] T015 [P] Testes unitários para [componente] em `[caminho]`
- [ ] T016 Rodar `quickstart.md` manualmente e confirmar todos os passos
- [ ] T017 [P] Atualizar documentação relevante
- [ ] T018 Remover duplicação, revisar nomes, revisar performance

## Dependências

- Testes (T004-T006) antes de Implementação Core (T007-T011)
- T007/T008 antes de T009; T009 antes de T010
- Implementação antes de Polimento (T015-T018)

## Exemplo de execução em paralelo

```
# T004, T005, T006 tocam arquivos de teste diferentes e são independentes entre si:
Tarefa: "Teste de contrato para [endpoint 1] em [caminho]"
Tarefa: "Teste de contrato para [endpoint 2] em [caminho]"
Tarefa: "Teste de integração para [cenário 1] em [caminho]"
```

## Notas

- `[P]` = arquivos diferentes, sem dependências entre as tarefas marcadas
- Caminhos de arquivo/pasta e identificadores nas tarefas sempre em **inglês** (regra fixa do kit — ver constituição); a descrição da tarefa fica em português
- Verificar que cada teste falha antes de implementar o código correspondente
- Commitar após cada tarefa concluída
- Evitar: tarefas vagas, conflitos no mesmo arquivo marcadas como `[P]`
- Tarefa de UI: citar no texto o arquivo de design que a governa (`design/screens/<tela>.md` ou `design/components.md#<componente>`) e usar `design/tokens.*` para valores visuais
