# Especificação de Feature: Backend App Setup

**Branch**: `001-backendappsetup`
**Criado em**: 2026-09-03
**Status**: Rascunho
**Entrada**: descrição original do usuário: "setup -> nessa spec vamos criar o setup do nosso back-end app, criar as pastas com a estrutura definida, instalar as libs necessarias, as classes/functions default do app e etc."

---

## Cenários de Usuário & Testes *(obrigatório)*

### História principal

Uma pessoa desenvolvedora clona o repositório vazio e precisa de um backend pronto para receber as próximas features. Ao final deste setup, ela consegue subir um banco local, iniciar a aplicação, verificar que ela está saudável por um endpoint de health-check, rodar a suíte de testes (unitários e de integração) e o lint, e tem um exemplo funcional ponta a ponta (`health`) mostrando exatamente onde e como escrever controller, service e repository nas próximas features. A integração contínua valida tudo isso a cada push.

### Cenários de aceitação

1. **Dado** o repositório recém-clonado e as dependências instaladas, **quando** a pessoa sobe o banco local e inicia a aplicação com todas as variáveis de ambiente válidas, **então** a aplicação inicia sem erro e passa a aceitar requisições HTTP.
2. **Dado** a aplicação no ar e o banco acessível, **quando** a pessoa faz `GET /health`, **então** recebe `200` com corpo `{ "status": "ok", "db": "up", "uptime": <segundos> }`.
3. **Dado** a aplicação no ar e o banco **inacessível**, **quando** a pessoa faz `GET /health`, **então** recebe `503` com corpo `{ "status": "degraded", "db": "down", "uptime": <segundos> }`.
4. **Dado** que uma variável de ambiente obrigatória está ausente ou com valor inválido, **quando** a pessoa tenta iniciar a aplicação, **então** a aplicação **não sobe** e imprime uma mensagem indicando qual variável está errada e por quê.
5. **Dado** o código do setup, **quando** a pessoa roda a suíte de testes unitários, **então** todos passam sem necessidade de banco.
6. **Dado** o código do setup, **quando** a pessoa roda a suíte de testes de integração, **então** todos passam usando uma instância de banco em memória (sem depender de banco externo).
7. **Dado** a aplicação em execução, **quando** o processo recebe `SIGTERM` ou `SIGINT`, **então** ela para de aceitar novas requisições, conclui as em andamento, fecha a conexão com o banco e encerra com código de saída zero.
8. **Dado** uma requisição que dispara um erro de domínio (erro que estende o tipo de erro base), **quando** a resposta é montada, **então** o corpo segue o formato `{ "error": { "code": <SCREAMING_SNAKE_CASE>, "message": <texto>, "statusCode": <número> } }` e o status HTTP é o que o próprio erro declara.
9. **Dado** uma requisição com corpo/parâmetros que falham a validação de schema, **quando** a resposta é montada, **então** o status é `400` e o corpo inclui `error.details` descrevendo os campos inválidos.
10. **Dado** uma requisição que dispara um erro não tratado, **quando** a resposta é montada, **então** o status é `500` e o corpo é genérico, sem expor stack trace nem mensagem interna.
11. **Dado** um push para o repositório, **quando** o pipeline de CI executa, **então** ele roda, nesta ordem, instalação de dependências, lint, testes unitários, testes de integração e build, e falha se qualquer etapa falhar.
12. **Dado** o pipeline de CI, **quando** a cobertura de testes das regras de negócio fica abaixo de 70%, **então** o pipeline falha.
13. **Dado** cada camada da aplicação, **quando** a pessoa abre a pasta de um domínio, **então** encontra um `index.ts` que reexporta os membros públicos com exports nomeados e nenhum `export default` em todo o código.

### Casos de borda

- Banco fica indisponível **depois** da aplicação ter subido: `GET /health` passa a responder `503`; a aplicação continua no ar (não derruba o processo).
- `GET /health` deve responder mesmo sob indisponibilidade do banco (o health-check não pode depender de o banco estar de pé para retornar).
- Variável de ambiente presente porém com tipo/formato inválido (ex.: porta não numérica) é tratada como inválida — mesmo comportamento de fail-fast do cenário 4.
- Recebimento de um segundo `SIGTERM` durante o encerramento gracioso não deve corromper o processo de shutdown.
- `docker compose` já com um Mongo rodando na mesma porta: documentado no README como resolver (porta configurável).

## Requisitos *(obrigatório)*

### Requisitos funcionais

**Estrutura e convenções**

- **RF-001**: O projeto DEVE criar a estrutura de pastas por camada descrita em `.specify/memory/architecture.md` (`controllers/`, `services/`, `repositories/`, `schemas/`, `errors/`, `config/`, `container/`, `db/` sob `src/`), com as subpastas por domínio contendo `index.ts` de re-export.
- **RF-002**: Todo módulo DEVE usar exports nomeados; o código NÃO DEVE conter nenhum `export default`.
- **RF-003**: O projeto DEVE fixar a versão do runtime em Node 24 via `.nvmrc` e via o campo `engines` do manifesto de pacote.
- **RF-004**: O projeto DEVE separar a suíte de testes unitários da suíte de testes de integração, com comandos distintos para rodar cada uma e um comando que roda ambas.

**Dependências e ferramentas**

- **RF-005**: O projeto DEVE instalar e configurar as bibliotecas necessárias para: servidor HTTP, injeção de dependências, driver de banco, validação de schema, ferramenta de migrations, runner de testes, teste de integração com banco em memória, lint e formatação — conforme decidido em `.specify/memory/architecture.md`.
- **RF-006**: O projeto DEVE prover configuração de lint/format e um comando de lint que retorna erro quando há violações.
- **RF-007**: O projeto DEVE prover um comando de build que compila o código e falha em erro de tipo.
- **RF-008**: O projeto DEVE prover a infraestrutura de migrations (arquivo de configuração, pasta de migrations e comandos para aplicar, reverter e criar migrations). NÃO DEVE incluir nenhuma migration de dados nesta feature.

**Configuração**

- **RF-009**: A aplicação DEVE ler as variáveis de ambiente `NODE_ENV`, `PORT`, `HOST`, `MONGO_URI`, `MONGO_DB_NAME` e `LOG_LEVEL`.
- **RF-010**: A aplicação DEVE validar as variáveis de ambiente na inicialização e, se alguma obrigatória estiver ausente ou inválida, DEVE abortar a inicialização exibindo qual variável falhou e o motivo (fail-fast).
- **RF-011**: O repositório DEVE versionar um arquivo de exemplo de ambiente listando todas as variáveis suportadas.
- **RF-012**: A aplicação DEVE expor a configuração validada como um valor tipado, consumido pelas demais partes do app; nenhuma outra parte do código DEVE ler variáveis de ambiente diretamente.

**Ciclo de vida e observabilidade**

- **RF-013**: A aplicação DEVE ter um entrypoint que apenas lê a configuração e inicia a escuta, separado do módulo que monta a instância do servidor e registra plugins.
- **RF-014**: A aplicação DEVE registrar logs estruturados, com nível controlado por `LOG_LEVEL`, e DEVE correlacionar os logs de uma mesma requisição por um identificador de requisição (`request-id`).
- **RF-015**: A aplicação DEVE, ao receber `SIGTERM` ou `SIGINT`, parar de aceitar novas requisições, concluir as em andamento, fechar a conexão com o banco e encerrar com código de saída zero.
- **RF-016**: A aplicação DEVE estabelecer a conexão com o banco na inicialização e disponibilizá-la às camadas via injeção de dependências.

**Health-check (fatia de referência)**

- **RF-017**: A aplicação DEVE expor `GET /health`.
- **RF-018**: Quando o banco está acessível, `GET /health` DEVE retornar `200` com `{ "status": "ok", "db": "up", "uptime": <segundos desde o start> }`.
- **RF-019**: Quando o banco está inacessível, `GET /health` DEVE retornar `503` com `{ "status": "degraded", "db": "down", "uptime": <segundos desde o start> }`, sem derrubar o processo.
- **RF-020**: A funcionalidade de health-check DEVE ser implementada como uma fatia vertical completa — plugin de rotas do domínio, handler HTTP, service de regra de negócio e repository (interface + implementação) — servindo de template para as próximas features.
- **RF-021**: A verificação de conectividade com o banco DEVE ocorrer no repository (a única camada que fala com o driver do banco); o service DEVE compor o resultado do health-check a partir dessa verificação e do tempo de atividade.
- **RF-022**: A fatia `health` DEVE ter teste unitário para as funções que não são regra de negócio e teste de integração (com banco em memória) para o service de regra de negócio, cobrindo o caminho "banco acessível" e o caminho "banco inacessível".

**Tratamento de erros na borda**

- **RF-023**: A aplicação DEVE ter um tratador de erros global que converte erros em respostas HTTP.
- **RF-024**: O projeto DEVE definir um tipo de erro base do qual todos os erros de domínio derivam; cada erro de domínio DEVE declarar um `code` estável em SCREAMING_SNAKE_CASE e o `statusCode` HTTP correspondente.
- **RF-025**: Para erro que deriva do tipo base, a resposta DEVE ter o status declarado pelo erro e corpo `{ "error": { "code", "message", "statusCode" } }`.
- **RF-026**: Para erro de validação de schema, a resposta DEVE ter status `400` e corpo `{ "error": { "code", "message", "statusCode": 400, "details" } }`, onde `details` descreve os campos inválidos.
- **RF-027**: Para erro não tratado, a resposta DEVE ter status `500` e corpo genérico, sem expor stack trace, mensagem interna ou detalhes do driver do banco.
- **RF-028**: O driver do banco NÃO DEVE ter exceções cruas vazando para além da camada de repository; o repository DEVE convertê-las em erros que derivam do tipo base.

**Ambiente local**

- **RF-029**: O repositório DEVE prover um `docker-compose` que sobe uma instância local de MongoDB utilizável pela aplicação e pelo `MONGO_URI` do arquivo de exemplo.
- **RF-030**: O README DEVE documentar os passos para rodar localmente: subir o banco, instalar dependências, configurar ambiente, iniciar a aplicação, rodar testes e lint.

**Integração contínua**

- **RF-031**: O repositório DEVE ter um pipeline de CI que, a cada push e pull request, executa nesta ordem: instalação de dependências, lint, testes unitários, testes de integração e build.
- **RF-032**: O pipeline de CI DEVE falhar se qualquer etapa falhar.
- **RF-033**: O runner de testes DEVE produzir relatório de cobertura, e o pipeline de CI DEVE falhar se a cobertura das regras de negócio (código em `services/`) ficar abaixo de 70%.

### Entidades-chave *(se a feature envolve dados)*

- **HealthStatus**: representa o resultado do health-check. Atributos: `status` (`ok` | `degraded`), `db` (`up` | `down`), `uptime` (segundos desde a inicialização). Não é persistida — é montada a cada requisição.
- **AppConfig**: representa a configuração validada da aplicação, derivada das variáveis de ambiente (`nodeEnv`, `port`, `host`, `mongoUri`, `mongoDbName`, `logLevel`). Criada uma vez na inicialização.
- **AppError** (tipo base): representa qualquer erro de domínio. Atributos: `code` (identificador estável), `message` (texto), `statusCode` (status HTTP). Erros específicos derivam deste tipo.

---

## Definição de Pronto (Definition of Done) *(obrigatório)*

- [ ] Instalação de dependências limpa e build sem erros de tipo
- [ ] O `docker-compose` sobe o Mongo; a aplicação sobe e `GET /health` responde `200` com `db: "up"`
- [ ] Com o Mongo parado, `GET /health` responde `503` com `db: "down"` e a aplicação continua no ar
- [ ] Variável de ambiente obrigatória ausente/inválida → a aplicação não sobe e imprime o que está errado
- [ ] Testes unitários e testes de integração passam; a integração usa banco em memória
- [ ] Cobertura das regras de negócio ≥ 70%, caso contrário o CI falha
- [ ] Lint sem erros
- [ ] Pipeline de CI verde: instalação → lint → testes unitários → testes de integração → build
- [ ] Estrutura de pastas das camadas criada conforme `.specify/memory/architecture.md`, com `index.ts` de re-export e nenhum `export default`
- [ ] Fatia `health` completa (controller → service → repository) servindo de template, com teste unitário e de integração
- [ ] Erro que deriva do tipo base vira resposta HTTP no formato `{ error: { code, message, statusCode, details? } }`; erro não tratado → `500` genérico
- [ ] `SIGTERM`/`SIGINT` encerram a aplicação fechando a conexão com o Mongo
- [ ] Arquivo de exemplo de ambiente, `.nvmrc` e `engines` (Node 24) versionados
- [ ] README com os passos para rodar localmente

---

## Esclarecimentos

*Preenchido pelo comando `/clarify`. Cada rodada adiciona uma subseção com data.*

### Sessão 2026-09-03

- P: Ao final da feature, o que deve ser observável rodando o app? → R: Esqueleto + uma fatia vertical de referência, com um domínio `health` completo (controller → service → repository) servindo de template, com teste unitário e de integração passando.
- P: Quais variáveis de ambiente entram nesta feature e qual o comportamento em caso de valor ausente/inválido? → R: `NODE_ENV`, `PORT`, `HOST`, `MONGO_URI`, `MONGO_DB_NAME`, `LOG_LEVEL`; fail-fast na inicialização; `.env.example` versionado.
- P: Qual o contrato da resposta de erro na borda? → R: `{ error: { code, message, statusCode, details? } }`, com `details` presente em erro de validação de schema; status do próprio erro para erros de domínio, `400` para validação, `500` genérico para não tratado.
- P: MongoDB local faz parte desta feature? → R: Sim, incluir `docker-compose` com Mongo nesta feature.
- P: Migrations incluem uma primeira migration real? → R: Não, apenas a infraestrutura de migrations; sem migration de dados.
- P: CI faz parte desta feature? → R: Sim, GitHub Actions rodando install → lint → test:unit → test:integration → build.
- P: Encerramento gracioso, versão do Node e request-id fazem parte? → R: Sim para encerramento gracioso e para fixar Node 24 (`.nvmrc` + `engines`); logging com `request-id` correlacionando a requisição.
- P: Qual o contrato do `GET /health`? → R: `200` `{ status: "ok", db: "up", uptime }` saudável; `503` `{ status: "degraded", db: "down", uptime }` com Mongo inacessível.
- P: Como o CI trata a exigência de cobertura? → R: Relatório de cobertura + gate que quebra o CI se a cobertura das regras de negócio ficar abaixo de 70%.
- P: Qual a Definição de Pronto? → R: A checklist registrada na seção "Definição de Pronto" acima.

---

## Checklist de Revisão

### Qualidade do conteúdo

- [x] Sem detalhes de implementação (linguagens, frameworks, APIs) — nomes de libs e stack ficam em `architecture.md`; a spec referencia "conforme decidido em architecture.md"
- [x] Focado em valor para o usuário e necessidades de negócio — o "usuário" aqui é a pessoa desenvolvedora que consumirá o setup
- [x] Escrito para stakeholders não-técnicos — dentro do possível para uma feature de infraestrutura
- [x] Todas as seções obrigatórias preenchidas

### Completude dos requisitos

- [x] Nenhum marcador `[NEEDS CLARIFICATION]` remanescente
- [x] Requisitos são testáveis e não-ambíguos
- [x] Critérios de sucesso são mensuráveis
- [x] Escopo está claramente delimitado
- [x] Dependências e premissas identificadas
- [x] Definição de Pronto preenchida, com critérios objetivos e verificáveis (não vagos)
