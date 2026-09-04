# curls/ — coleções locais de requisições

Pasta **não versionada** (`.gitignore` → `/curls/`). Serve para exercitar a API à mão
contra um MongoDB local.

Convenção: um arquivo por domínio, `<dominio>-curl.md`, dividido em fases numeradas
(Fase 0 = ambiente; depois um bloco por endpoint com o caminho feliz e os casos de erro).

- `auth-curl.md` — cadastro, login, refresh, logout, troca de senha, `/me`, rate limit.
- `books-curl.md` — (quando a feature de livros existir)
- `follows-curl.md`, `feed-curl.md`, … — idem.

Pré-requisito comum: `docker compose up -d` + `pnpm migrate:up` + `pnpm dev`.
