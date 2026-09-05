# Contrato: estrutura de `docs/`

Esta feature não expõe endpoint HTTP novo, então este "contrato" é a estrutura de arquivos que `docs/` DEVE ter ao final da implementação — usado como checklist objetiva pelo `/tasks` e pela Definição de Pronto.

## Estrutura obrigatória

```
docs/
├── README.md
├── openapi.yaml
├── auth-guide.md
├── pagination-guide.md
├── viewer-block.md
├── error-catalog.md
├── design-prompt.md
└── flows/
    ├── auth-flow.md
    ├── follow-flow.md
    ├── reading-flow.md
    ├── review-flow.md
    ├── feed-flow.md
    ├── interactions-flow.md
    └── notifications-flow.md
```

## Regras

- Todo nome de arquivo/pasta acima é em inglês (regra fixa do kit); todo conteúdo de prosa dentro deles é em português.
- `docs/README.md` DEVE linkar para todos os outros 12 arquivos/pastas acima — é o ponto de entrada único.
- Nenhum arquivo fora desta lista deve ser necessário para entender a API do ponto de vista do front-end (se um novo arquivo for necessário durante a implementação, ele deve ser adicionado aqui e ao `plan.md`, não criado silenciosamente).
- Nenhum arquivo em `src/`, `tests/` ou `migrations/` é criado, removido ou alterado por esta feature.
