# Ambiente de desenvolvimento local: [NOME DO PROJETO]

**Origem**: [detectado a partir do projeto + decisões tomadas com o usuário]
**Última atualização**: [DATA]

<!--
Este arquivo descreve COMO subir o projeto na máquina de um dev para testar
localmente. É conhecimento por-projeto (como architecture.md): rode /localdev uma
vez e de novo só quando a infra local mudar (nova dependência, troca de banco/broker,
nova integração externa).

Regras ao preencher:
- Valores concretos, sem placeholder genérico.
- Toda imagem de container com versão fixa (nada de :latest).
- Segredos NUNCA entram aqui nem no .env.example — só placeholders e defaults locais seguros.
- O que não roda localmente vai na seção "Não roda localmente", explícito.
- Conteúdo entre <!-- SDD:MANUAL:INICIO --> e <!-- SDD:MANUAL:FIM --> é preservado no re-run.
-->

## Como rodar (resumo)

```bash
# 1. copie o exemplo de env e preencha os segredos
cp .env.example .env

# 2. suba as dependências de infra
[ex.: docker compose -f docker-compose.dev.yml up -d]

# 3. rode migrations / seed (se houver)
[ex.: npm run db:migrate && npm run db:seed]

# 4. suba a aplicação
[ex.: npm run dev]
```

## Pré-requisitos

Ferramentas que o dev precisa ter instaladas (com versão mínima quando importa):

| Ferramenta | Versão | Para quê | Como instalar |
|---|---|---|---|
| [ex.: Docker + Compose v2] | [ex.: 24+] | [subir banco/broker] | [link / gerenciador] |
| [ex.: Node.js] | [ex.: 20.x] | [rodar a API] | [nvm / asdf] |

## Serviços e dependências

Tudo que a aplicação precisa para funcionar localmente. Uma linha por dependência.

| Dependência | Papel no sistema | Como rodar localmente | Config / credenciais |
|---|---|---|---|
| [ex.: MongoDB] | [banco principal] | [container `mongo:7` no compose dev] | [`MONGO_URI=mongodb://localhost:27017/app`] |
| [ex.: Kafka] | [mensageria de eventos de pedido] | [container `redpanda` no compose dev; tópicos criados por `scripts/dev/create-topics.sh`] | [`KAFKA_BROKERS=localhost:9092`] |
| [ex.: Redis] | [cache de sessão] | [container `redis:7` no compose dev] | [`REDIS_URL=redis://localhost:6379`] |

### Portas usadas

| Porta | Serviço |
|---|---|
| [ex.: 3000] | [API] |
| [ex.: 27017] | [MongoDB] |
| [ex.: 9092] | [Kafka] |

## Passo a passo detalhado

1. [passo com o comando exato]
2. [...]
3. [como saber que subiu — ver "Verificação" abaixo]

## Variáveis de ambiente

Fonte da verdade: **`.env.example`** (na raiz). Copie para `.env` e preencha.

| Variável | Obrigatória | Default local | Observação |
|---|---|---|---|
| [ex.: `MONGO_URI`] | sim | `mongodb://localhost:27017/app` | aponta pro container do compose |
| [ex.: `STRIPE_API_KEY`] | sim | — (vazio) | segredo: pegar no dashboard do fornecedor (sandbox) |

## Dados de exemplo / seed

[Como popular o ambiente com dados mínimos para testar: comando de seed, fixtures,
usuário de teste padrão (login/senha), coleção/tabela que precisa existir. Se não
houver seed, dizer explicitamente "sem seed — o banco sobe vazio".]

## Não roda localmente

Dependências que **não** dá para simular fielmente na máquina do dev. Não finja que
funcionam — trate cada uma com a estratégia indicada.

| Integração | Por que não roda local | O que fazer no dev |
|---|---|---|
| [ex.: Gateway de pagamento X] | [SDK fechado, exige domínio homologado] | [usar sandbox do fornecedor com as chaves de teste em `.env`; ou `PAYMENTS_ENABLED=false` para pular o fluxo] |
| [ex.: SSO corporativo] | [só responde a IPs da VPN] | [usar o login mock local (`AUTH_PROVIDER=mock`)] |

## Stubs / mocks locais

[Preenchido só se o usuário pediu para gerar stubs no /localdev. Lista cada stub
gerado, o que ele finge ser, como ligá-lo (env var / porta) e suas limitações.
Se nenhum stub foi gerado, remover esta seção.]

## Arquivos gerados pelo /localdev

[Lista dos arquivos que este comando criou ou alterou, para o dev saber o que revisar:
ex.: `docker-compose.dev.yml` (novo), `.env.example` (novo), `scripts/dev/create-topics.sh` (novo),
`Makefile` (alvos `dev-up`/`dev-down` adicionados).]

## Verificação (smoke test)

Como confirmar que o ambiente subiu inteiro:

- [ ] [ex.: `curl -sf localhost:3000/health` retorna 200]
- [ ] [ex.: `docker compose -f docker-compose.dev.yml ps` mostra todos os serviços `healthy`]
- [ ] [ex.: o consumer loga "connected" nos brokers]

## Problemas comuns

| Sintoma | Causa provável | Correção |
|---|---|---|
| [ex.: `ECONNREFUSED :27017`] | [container do Mongo ainda subindo] | [aguardar healthcheck; `docker compose logs mongo`] |

<!-- SDD:MANUAL:INICIO -->
<!-- Notas manuais do time sobre o ambiente local. Preservado no re-run do /localdev. -->
<!-- SDD:MANUAL:FIM -->

## Histórico

| Data | Mudança |
|---|---|
| [DATA] | Configuração inicial do ambiente local. |
