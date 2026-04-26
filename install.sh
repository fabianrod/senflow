#!/usr/bin/env bash
set -euo pipefail

REPO_OWNER="${SENFLOW_REPO_OWNER:-fabianrod}"
REPO_NAME="${SENFLOW_REPO_NAME:-senflow}"
REPO_REF="${SENFLOW_REPO_REF:-main}"
SOURCE_DIR="${SENFLOW_SOURCE_DIR:-}"
SENFLOW_HOME="${SENFLOW_HOME:-$HOME/.senflow}"
APP_DIR="${SENFLOW_APP_DIR:-$SENFLOW_HOME/app}"
BIN_DIR="${SENFLOW_BIN_DIR:-$HOME/.local/bin}"
LAUNCHER_PATH="$BIN_DIR/senflow"
REPO_URL="https://github.com/$REPO_OWNER/$REPO_NAME.git"

log() {
  printf '[senflow-install] %s\n' "$1"
}

fail() {
  printf '[senflow-install:error] %s\n' "$1" >&2
  exit 1
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    fail "Se requiere '$1' para continuar."
  fi
}

log "Validando prerequisitos..."
require_command git
require_command node
require_command npm

mkdir -p "$SENFLOW_HOME"
mkdir -p "$BIN_DIR"

if [ -n "$SOURCE_DIR" ]; then
  if [ ! -d "$SOURCE_DIR" ]; then
    fail "SENFLOW_SOURCE_DIR no existe: $SOURCE_DIR"
  fi
  if [ -d "$APP_DIR" ]; then
    rm -rf "$APP_DIR"
  fi
  log "Copiando SenFlow desde SENFLOW_SOURCE_DIR..."
  cp -R "$SOURCE_DIR" "$APP_DIR"
else
  if [ -d "$APP_DIR/.git" ]; then
    log "Actualizando SenFlow en $APP_DIR..."
    git -C "$APP_DIR" fetch --depth=1 origin "$REPO_REF"
    git -C "$APP_DIR" checkout "$REPO_REF"
    if ! git -C "$APP_DIR" pull --ff-only origin "$REPO_REF"; then
      fail "No se pudo actualizar en fast-forward. Revisa cambios locales en $APP_DIR."
    fi
  else
    if [ -d "$APP_DIR" ]; then
      rm -rf "$APP_DIR"
    fi
    log "Clonando SenFlow en $APP_DIR..."
    git clone --depth=1 --branch "$REPO_REF" "$REPO_URL" "$APP_DIR"
  fi
fi

cat >"$LAUNCHER_PATH" <<EOF
#!/usr/bin/env bash
set -euo pipefail
export SENFLOW_APP_DIR="$APP_DIR"
exec node "$APP_DIR/bin/senflow.js" "\$@"
EOF

chmod +x "$LAUNCHER_PATH"

log "Launcher instalado en $LAUNCHER_PATH"

if [[ ":$PATH:" != *":$BIN_DIR:"* ]]; then
  log "Agrega $BIN_DIR a tu PATH para usar 'senflow' globalmente."
fi

printf '\n'
log "Siguientes pasos:"
printf '  1) senflow install\n'
printf '  2) senflow run\n'
