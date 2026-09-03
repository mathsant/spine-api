#!/usr/bin/env bash
# Atualiza (ou cria) o CLAUDE.md na raiz do projeto-alvo com um resumo do contexto
# técnico da feature atual, extraído do plan.md. Preserva qualquer conteúdo fora
# dos marcadores AUTO-GERADO.
#
# Uso: update-agent-context.sh

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

eval "$(get_feature_paths)"

if [[ ! -f "$PLAN_FILE" ]]; then
    echo "ERRO: plan.md não encontrado em $PLAN_FILE. Rode /plan primeiro." >&2
    exit 1
fi

AGENT_FILE="$REPO_ROOT/CLAUDE.md"
TEMPLATE_FILE="$REPO_ROOT/.specify/templates/agent-file-template.md"
START_MARK="<!-- SDD:AUTO-GERADO:INICIO -->"
END_MARK="<!-- SDD:AUTO-GERADO:FIM -->"

# Extrai a seção "## Contexto Técnico" do plan.md (até o próximo cabeçalho ##),
# ignorando linhas de comentário HTML do próprio template.
TECH_CONTEXT=$(awk '/^## Contexto Técnico/{flag=1; next} /^## /{flag=0} flag && !/^<!--/' "$PLAN_FILE" || true)

if [[ -z "$TECH_CONTEXT" ]]; then
    TECH_CONTEXT="(nenhum contexto técnico encontrado em $PLAN_FILE)"
fi

GENERATED_BLOCK=$(cat <<EOF
$START_MARK
<!-- Gerado automaticamente por update-agent-context.sh a partir de $PLAN_FILE. -->
<!-- Não edite esta seção manualmente; edite o plan.md e rode o script de novo. -->

## Stack ativa (feature: $CURRENT_BRANCH)

$TECH_CONTEXT

$END_MARK
EOF
)

if [[ -f "$AGENT_FILE" ]] && grep -q "$START_MARK" "$AGENT_FILE"; then
    # Substitui o bloco existente entre os marcadores. O bloco vai por um arquivo
    # temporário (via getline) em vez de -v, porque o awk padrão do macOS (BSD/one-true-awk)
    # não lida bem com valores -v contendo múltiplas linhas.
    BLOCK_FILE=$(mktemp)
    printf '%s\n' "$GENERATED_BLOCK" > "$BLOCK_FILE"
    awk -v start="$START_MARK" -v end="$END_MARK" -v blockfile="$BLOCK_FILE" '
        $0 == start {
            while ((getline line < blockfile) > 0) print line
            skip=1
            next
        }
        $0 == end { skip=0; next }
        skip { next }
        { print }
    ' "$AGENT_FILE" > "$AGENT_FILE.tmp"
    mv "$AGENT_FILE.tmp" "$AGENT_FILE"
    rm -f "$BLOCK_FILE"
    echo "CLAUDE.md atualizado: $AGENT_FILE"
else
    # Cria o arquivo do zero a partir do template, se existir, e anexa o bloco.
    if [[ -f "$TEMPLATE_FILE" ]] && [[ ! -f "$AGENT_FILE" ]]; then
        cp "$TEMPLATE_FILE" "$AGENT_FILE"
    fi
    {
        echo ""
        echo "$GENERATED_BLOCK"
    } >> "$AGENT_FILE"
    echo "CLAUDE.md criado/atualizado: $AGENT_FILE"
fi
