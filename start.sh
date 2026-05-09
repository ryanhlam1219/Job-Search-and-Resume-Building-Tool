#!/usr/bin/env bash
# ============================================================
# JobAssist AI — startup / stop script
# Usage:
#   ./start.sh          — install deps (if needed) and start
#   ./start.sh stop     — gracefully stop all services
# ============================================================
set -euo pipefail

if [[ "$(uname)" != "Darwin" ]]; then
  echo "Error: JobAssist AI only supports macOS." >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_DIR="$SCRIPT_DIR/.pids"
LOG_DIR="$SCRIPT_DIR/.logs"
APP_PORT=3000
SCRAPER_PORT=8000
POSTGRES_PORT=5432
OLLAMA_PORT=11434
# Read model from .env.local → .env.example → hardcoded fallback
_read_model() {
  for f in "$SCRIPT_DIR/.env.local" "$SCRIPT_DIR/.env.example"; do
    if [[ -f "$f" ]]; then
      local val; val=$(grep -E '^OLLAMA_MODEL=' "$f" | head -1 | sed 's/OLLAMA_MODEL=//;s/"//g;s/'"'"'//g')
      if [[ -n "$val" ]]; then echo "$val"; return; fi
    fi
  done
  echo "llama3.2"
}
OLLAMA_MODEL="$(_read_model)"
DB_NAME="job_assistant"
DB_USER="postgres"
DB_PASS="password"

# ── colours ──────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; CYAN='\033[0;36m'; NC='\033[0m'
info()    { echo -e "${CYAN}[info]${NC}  $*"; }
success() { echo -e "${GREEN}[ok]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[warn]${NC}  $*"; }
error()   { echo -e "${RED}[error]${NC} $*" >&2; }

# ═══════════════════════════════════════════════════════════════
#  STOP
# ═══════════════════════════════════════════════════════════════
stop_services() {
  info "Stopping JobAssist AI services…"

  for svc in next scraper ollama watcher; do
    PID_FILE="$PID_DIR/$svc.pid"
    if [[ -f "$PID_FILE" ]]; then
      PID=$(cat "$PID_FILE")
      if kill -0 "$PID" 2>/dev/null; then
        # Kill the process and all its children (next-server, turbopack workers, etc.)
        kill -- -"$(ps -o pgid= -p "$PID" 2>/dev/null | tr -d ' ')" 2>/dev/null \
          || kill "$PID" 2>/dev/null || true
        success "Stopped $svc (pid $PID)"
      else
        warn "$svc (pid $PID) was not running"
      fi
      rm -f "$PID_FILE"
    else
      warn "No PID file for $svc"
    fi
  done

  # Belt-and-suspenders: kill any lingering next-server or turbopack processes
  pkill -f "next-server" 2>/dev/null || true
  pkill -f "next dev" 2>/dev/null || true

  # Stop PostgreSQL if we started it via brew services
  if brew services list 2>/dev/null | grep -q "postgresql.*started"; then
    brew services stop postgresql@16 2>/dev/null \
      || brew services stop postgresql 2>/dev/null \
      || true
    success "Stopped PostgreSQL"
  fi

  success "All services stopped."
  exit 0
}

[[ "${1:-}" == "stop" ]] && stop_services

# ═══════════════════════════════════════════════════════════════
#  INSTALL
# ═══════════════════════════════════════════════════════════════

install_deps() {
  # ── Homebrew ──────────────────────────────────────────────
  if ! command -v brew &>/dev/null; then
    info "Installing Homebrew…"
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    # Add brew to PATH for Apple Silicon
    if [[ -f /opt/homebrew/bin/brew ]]; then
      eval "$(/opt/homebrew/bin/brew shellenv)"
    fi
  else
    success "Homebrew already installed ($(brew --version | head -1))"
  fi

  # ── Node.js ───────────────────────────────────────────────
  if ! command -v node &>/dev/null || [[ $(node -e "process.exit(process.version.slice(1).split('.')[0] < 22 ? 1 : 0)" 2>/dev/null; echo $?) -ne 0 ]]; then
    info "Installing Node.js 22 via Homebrew…"
    brew install node@22
    brew link node@22 --force --overwrite
    export PATH="/opt/homebrew/opt/node@22/bin:/usr/local/opt/node@22/bin:$PATH"
  else
    success "Node.js already installed ($(node --version))"
  fi

  # ── npm ───────────────────────────────────────────────────
  if ! command -v npm &>/dev/null; then
    info "npm not found — reinstalling Node…"
    brew reinstall node@22
    brew link node@22 --force --overwrite
    export PATH="/opt/homebrew/opt/node@22/bin:/usr/local/opt/node@22/bin:$PATH"
  else
    success "npm already installed ($(npm --version))"
  fi

  # ── Python 3.11 ───────────────────────────────────────────
  # Check for python3.11 specifically — a newer system python (e.g. 3.14
  # installed as an Ollama dependency) is NOT a substitute because the venv
  # is pinned to 3.11.
  if ! command -v python3.11 &>/dev/null && [[ ! -x /opt/homebrew/bin/python3.11 ]]; then
    info "Installing Python 3.11 via Homebrew…"
    brew install python@3.11
    brew link python@3.11 --force --overwrite
  else
    success "Python 3.11 already installed"
  fi
  export PATH="/opt/homebrew/opt/python@3.11/bin:/usr/local/opt/python@3.11/bin:$PATH"

  # Resolve PYTHON_BIN to python3.11 explicitly
  local PYTHON_BIN=""
  for _py in python3.11 /opt/homebrew/bin/python3.11 /usr/local/bin/python3.11 \
              /opt/homebrew/opt/python@3.11/bin/python3.11; do
    if command -v "$_py" &>/dev/null || [[ -x "$_py" ]]; then
      PYTHON_BIN="$(command -v "$_py" 2>/dev/null || echo "$_py")"
      break
    fi
  done
  [[ -z "$PYTHON_BIN" ]] && { error "Could not find Python 3.11 — run ./setup.sh first."; exit 1; }

  # ── pip / venv ────────────────────────────────────────────
  if ! "$PYTHON_BIN" -m pip --version &>/dev/null; then
    info "Installing pip…"
    "$PYTHON_BIN" -m ensurepip --upgrade || true
  else
    success "pip already installed"
  fi

  # ── PostgreSQL ────────────────────────────────────────────
  if ! command -v psql &>/dev/null; then
    info "Installing PostgreSQL 16 via Homebrew…"
    brew install postgresql@16
    brew link postgresql@16 --force
    export PATH="/opt/homebrew/opt/postgresql@16/bin:/usr/local/opt/postgresql@16/bin:$PATH"
  else
    success "PostgreSQL already installed ($(psql --version))"
  fi

  # ── Ollama ────────────────────────────────────────────────
  if ! command -v ollama &>/dev/null; then
    info "Installing Ollama…"
    brew install ollama
  else
    success "Ollama already installed ($(ollama --version 2>/dev/null || echo 'unknown version'))"
  fi

  # ── npm deps ──────────────────────────────────────────────
  cd "$SCRIPT_DIR"
  if [[ ! -d node_modules ]]; then
    info "Installing Node.js dependencies…"
    npm install --loglevel=error
  else
    success "node_modules already present"
  fi

  # ── Python scraper deps ───────────────────────────────────
  SCRAPER_DIR="$SCRIPT_DIR/backend/scraper"
  VENV_DIR="$SCRAPER_DIR/.venv"
  if [[ ! -d "$VENV_DIR" ]]; then
    info "Creating Python virtual environment…"
    "$PYTHON_BIN" -m venv "$VENV_DIR"
  fi
  VENV_PYTHON="$VENV_DIR/bin/python"

  # Fix pip SSL / truststore bug on fresh macOS Python builds:
  # pip's vendored certifi and the runtime certifi used by jobspy/LinkedIn
  # may both ship without their cacert.pem. Copy the macOS system bundle.
  local SYSTEM_CERT="/etc/ssl/cert.pem"
  if [[ -f "$SYSTEM_CERT" ]]; then
    export SSL_CERT_FILE="$SYSTEM_CERT"
    export REQUESTS_CA_BUNDLE="$SYSTEM_CERT"
    for _certifi_dir in \
      "$("$VENV_PYTHON" -c 'import pip._vendor.certifi as c, os; print(os.path.dirname(c.__file__))' 2>/dev/null)" \
      "$("$VENV_PYTHON" -c 'import certifi, os; print(os.path.dirname(certifi.__file__))' 2>/dev/null)"; do
      if [[ -n "$_certifi_dir" && -d "$_certifi_dir" && ! -f "$_certifi_dir/cacert.pem" ]]; then
        cp "$SYSTEM_CERT" "$_certifi_dir/cacert.pem"
      fi
    done
  fi

  if [[ ! -f "$VENV_DIR/.installed" ]]; then
    info "Installing Python scraper dependencies…"
    "$VENV_PYTHON" -m pip install --upgrade pip --no-cache-dir -q \
      --trusted-host pypi.org --trusted-host files.pythonhosted.org --trusted-host pypi.python.org
    "$VENV_PYTHON" -m pip install --no-cache-dir -q \
      --trusted-host pypi.org --trusted-host files.pythonhosted.org --trusted-host pypi.python.org \
      -r "$SCRAPER_DIR/requirements.txt"
    touch "$VENV_DIR/.installed"
    success "Python dependencies installed"
  else
    success "Python scraper dependencies already installed"
  fi
}

# ═══════════════════════════════════════════════════════════════
#  ENVIRONMENT
# ═══════════════════════════════════════════════════════════════

setup_env() {
  cd "$SCRIPT_DIR"
  if [[ ! -f .env.local ]]; then
    if [[ -f .env.example ]]; then
      cp .env.example .env.local
      warn ".env.local created from .env.example — Ollama AI features require the Ollama service to be running"
    else
      cat > .env.local <<EOF
DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@localhost:${POSTGRES_PORT}/${DB_NAME}"
OLLAMA_BASE_URL="http://localhost:${OLLAMA_PORT}/v1"
OLLAMA_MODEL="${OLLAMA_MODEL}"
SCRAPER_SERVICE_URL="http://localhost:${SCRAPER_PORT}"
NEXT_PUBLIC_APP_URL="http://localhost:${APP_PORT}"
EOF
      warn ".env.local created — Ollama must be running to enable AI features"
    fi
  else
    success ".env.local already exists"
  fi

  # Ensure DATABASE_URL is set correctly for local dev
  if ! grep -q "DATABASE_URL" .env.local; then
    echo "DATABASE_URL=\"postgresql://${DB_USER}:${DB_PASS}@localhost:${POSTGRES_PORT}/${DB_NAME}\"" >> .env.local
  fi
}

# ═══════════════════════════════════════════════════════════════
#  DATABASE
# ═══════════════════════════════════════════════════════════════

setup_database() {
  # Start PostgreSQL
  if ! pg_isready -q 2>/dev/null; then
    info "Starting PostgreSQL…"
    brew services start postgresql@16 2>/dev/null \
      || brew services start postgresql 2>/dev/null \
      || pg_ctl -D /opt/homebrew/var/postgresql@16 start 2>/dev/null \
      || true
    # Wait up to 20s for Postgres to be ready
    for i in $(seq 1 20); do
      pg_isready -q && break
      sleep 1
    done
  fi
  pg_isready -q && success "PostgreSQL is running" || { error "PostgreSQL failed to start"; exit 1; }

  # Ensure the 'postgres' superuser role exists (macOS Homebrew uses the system
  # username as the default superuser, not 'postgres')
  LOCAL_PSQL_DB="postgres"
  if ! psql -d "$LOCAL_PSQL_DB" -tAc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}';" 2>/dev/null | grep -q 1; then
    info "Creating role '${DB_USER}'…"
    psql -d "$LOCAL_PSQL_DB" -c "CREATE ROLE ${DB_USER} WITH SUPERUSER CREATEDB CREATEROLE LOGIN PASSWORD '${DB_PASS}';" 2>/dev/null || true
    success "Role '${DB_USER}' created"
  else
    success "Role '${DB_USER}' already exists"
  fi

  # Create DB / user if they don't exist
  if ! psql -U "$DB_USER" -h localhost -lqt 2>/dev/null | cut -d'|' -f1 | grep -qw "$DB_NAME"; then
    info "Creating database '$DB_NAME'…"
    psql -U "$DB_USER" -h localhost -c "CREATE DATABASE ${DB_NAME};" 2>/dev/null || true
    success "Database created"
  else
    success "Database '$DB_NAME' already exists"
  fi

  # Run Prisma migrations
  cd "$SCRIPT_DIR"
  export DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@localhost:${POSTGRES_PORT}/${DB_NAME}"

  info "Running Prisma migrations…"
  npx prisma migrate deploy 2>/dev/null
  MIGRATE_EXIT=$?
  npx prisma generate --no-hints 2>/dev/null || npx prisma generate
  if [[ $MIGRATE_EXIT -eq 0 ]]; then
    # Wipe the entire .next directory so Next.js recompiles against the new Prisma client.
    rm -rf "$SCRIPT_DIR/.next"
    success "Prisma migrations applied"
  else
    warn "Prisma migration failed — check database connection"
  fi

  # Seed if the User table is empty
  USER_COUNT=$(psql -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT COUNT(*) FROM \"User\";" 2>/dev/null || echo "0")
  if [[ "$USER_COUNT" -eq 0 ]]; then
    info "Seeding database…"
    npm run db:seed 2>/dev/null && success "Database seeded" || warn "Seed skipped (non-fatal)"
  else
    success "Database already has data — skipping seed"
  fi
}

# ═══════════════════════════════════════════════════════════════
#  START SERVICES
# ═══════════════════════════════════════════════════════════════

start_services() {
  mkdir -p "$PID_DIR" "$LOG_DIR"
  cd "$SCRIPT_DIR"
  export DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@localhost:${POSTGRES_PORT}/${DB_NAME}"

  # ── Ollama server ───────────────────────────────────────
  if ! curl -s "http://localhost:${OLLAMA_PORT}/" >/dev/null 2>&1; then
    info "Starting Ollama server…"
    ollama serve >"$LOG_DIR/ollama.log" 2>&1 &
    echo $! > "$PID_DIR/ollama.pid"
    disown $!  # detach so it survives terminal closure
    # Wait up to 15s for Ollama to be ready
    for i in $(seq 1 15); do
      curl -s "http://localhost:${OLLAMA_PORT}/" >/dev/null 2>&1 && break
      sleep 1
    done
    success "Ollama server started (log: .logs/ollama.log)"
  else
    success "Ollama server already running"
  fi

  # Pull the model if not already present
  if ! ollama list 2>/dev/null | grep -q "^${OLLAMA_MODEL}"; then
    info "Pulling Ollama model '${OLLAMA_MODEL}' (this may take a few minutes)…"
    if ! ollama pull "${OLLAMA_MODEL}" 2>/dev/null; then
      if [[ "${OLLAMA_MODEL}" == *":cloud"* ]]; then
        warn "Cloud model pull failed — you may need to run 'ollama login' first."
        warn "Run: ollama login    (opens a browser, free account at ollama.com)"
        warn "Then restart with: ./start.sh"
      else
        warn "Failed to pull model '${OLLAMA_MODEL}' — AI features may not work."
      fi
    else
      success "Model '${OLLAMA_MODEL}' ready"
    fi
  else
    success "Ollama model '${OLLAMA_MODEL}' already present"
  fi

  # ── Python scraper ──────────────────────────────────────
  SCRAPER_DIR="$SCRIPT_DIR/backend/scraper"
  VENV_PYTHON="$SCRAPER_DIR/.venv/bin/python"
  [[ ! -f "$VENV_PYTHON" ]] && VENV_PYTHON="$SCRAPER_DIR/.venv/bin/python3"
  if [[ ! -f "$VENV_PYTHON" ]]; then
    warn "Python venv not found — run ./setup.sh first to install scraper dependencies"
    VENV_PYTHON=""
  fi
  if curl -s "http://localhost:${SCRAPER_PORT}/health" >/dev/null 2>&1; then
    success "Python scraper already running"
  elif [[ -n "$VENV_PYTHON" ]]; then
    info "Starting Python scraper on port ${SCRAPER_PORT}…"
    # Pass the macOS system cert bundle so certifi-backed libraries (e.g. jobspy's
    # LinkedIn scraper) can validate TLS connections without a missing cacert.pem.
    SSL_CERT_FILE=/etc/ssl/cert.pem \
    REQUESTS_CA_BUNDLE=/etc/ssl/cert.pem \
    "$VENV_PYTHON" "$SCRAPER_DIR/app.py" \
      >"$LOG_DIR/scraper.log" 2>&1 &
    echo $! > "$PID_DIR/scraper.pid"
    disown $!  # detach so it survives terminal closure
    # Wait up to 20s — Flask can take a few seconds to bind on a cold start
    for i in $(seq 1 20); do
      curl -s "http://localhost:${SCRAPER_PORT}/health" >/dev/null 2>&1 && break
      sleep 1
    done
    if curl -s "http://localhost:${SCRAPER_PORT}/health" >/dev/null 2>&1; then
      success "Scraper started (pid $(cat "$PID_DIR/scraper.pid")), log: .logs/scraper.log"
    else
      warn "Scraper may have failed to start — check .logs/scraper.log"
    fi
  fi

  # ── Next.js app ─────────────────────────────────────────
  if curl -s "http://localhost:${APP_PORT}" >/dev/null 2>&1; then
    success "Next.js already running on port ${APP_PORT}"
  else
    info "Starting Next.js on port ${APP_PORT}…"
    npm run dev -- --port "$APP_PORT" \
      >"$LOG_DIR/next.log" 2>&1 &
    echo $! > "$PID_DIR/next.pid"
    disown $!  # detach so it survives terminal closure
  fi

  # Wait for Next.js to be ready (up to 30s)
  info "Waiting for Next.js to be ready…"
  for i in $(seq 1 30); do
    if curl -s "http://localhost:${APP_PORT}" >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done

  echo ""
  echo -e "${GREEN}╔══════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║   JobAssist AI is running!                   ║${NC}"
  echo -e "${GREEN}║                                              ║${NC}"
  echo -e "${GREEN}║   App:     http://localhost:${APP_PORT}              ║${NC}"
  echo -e "${GREEN}║   Scraper: http://localhost:${SCRAPER_PORT}              ║${NC}"
  echo -e "${GREEN}║   Ollama:  http://localhost:${OLLAMA_PORT}           ║${NC}"
  echo -e "${GREEN}║   Model:   ${OLLAMA_MODEL}                        ║${NC}"
  echo -e "${GREEN}║                                              ║${NC}"
  echo -e "${GREEN}║   Stop:  ./start.sh stop                     ║${NC}"
  echo -e "${GREEN}║   Logs:  .logs/next.log                      ║${NC}"
  echo -e "${GREEN}║          .logs/scraper.log                   ║${NC}"
  echo -e "${GREEN}║          .logs/ollama.log                    ║${NC}"
  echo -e "${GREEN}╚══════════════════════════════════════════════╝${NC}"
  echo ""
}

# ═══════════════════════════════════════════════════════════════
#  MAIN
# ═══════════════════════════════════════════════════════════════

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║   JobAssist AI — starting up…                ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════╝${NC}"
echo ""

# ═══════════════════════════════════════════════════════════════
#  AUTO-UPDATE
# ═══════════════════════════════════════════════════════════════

check_for_updates() {
  if ! command -v git &>/dev/null; then return; fi
  if [[ ! -d "$SCRIPT_DIR/.git" ]]; then return; fi

  # Resolve the remote name dynamically (may be 'origin', 'job-assistant', etc.)
  GIT_REMOTE=$(git -C "$SCRIPT_DIR" remote | head -1)
  if [[ -z "$GIT_REMOTE" ]]; then
    warn "No git remote configured — skipping update check"
    return
  fi

  info "Checking for updates…"

  # Fetch with a 10s timeout so a slow connection doesn't delay startup
  # Use git's built-in http timeout (works on macOS without GNU coreutils)
  if ! git -C "$SCRIPT_DIR" -c http.connectTimeout=10 -c http.lowSpeedLimit=0 -c http.lowSpeedTime=10 fetch "$GIT_REMOTE" main --quiet 2>/dev/null; then
    warn "Could not reach GitHub — skipping update check"
    return
  fi

  LOCAL=$(git -C "$SCRIPT_DIR" rev-parse HEAD 2>/dev/null)
  REMOTE=$(git -C "$SCRIPT_DIR" rev-parse "$GIT_REMOTE/main" 2>/dev/null)

  if [[ "$LOCAL" == "$REMOTE" ]]; then
    success "Already up to date"
    return
  fi

  info "New version available — updating…"

  # Stash any accidental local changes so they don't block the pull
  git -C "$SCRIPT_DIR" stash push -m "auto-stash $(date)" --quiet 2>/dev/null || true

  if ! git -C "$SCRIPT_DIR" pull "$GIT_REMOTE" main --quiet 2>/dev/null; then
    warn "Auto-update failed — continuing with current version"
    return
  fi

  # Re-install npm packages only if package.json actually changed
  if git -C "$SCRIPT_DIR" diff HEAD@{1} HEAD --name-only 2>/dev/null | grep -qE 'package\.json|package-lock\.json'; then
    info "New packages detected — installing…"
    npm --prefix "$SCRIPT_DIR" install --loglevel=error 2>/dev/null || true
  fi

  # Re-install Python scraper deps if requirements.txt changed
  if git -C "$SCRIPT_DIR" diff HEAD@{1} HEAD --name-only 2>/dev/null | grep -q 'requirements\.txt'; then
    info "Python dependencies changed — reinstalling scraper packages…"
    local _venv_py="$SCRIPT_DIR/backend/scraper/.venv/bin/python"
    if [[ -f "$_venv_py" ]]; then
      rm -f "$SCRIPT_DIR/backend/scraper/.venv/.installed"
      SSL_CERT_FILE=/etc/ssl/cert.pem REQUESTS_CA_BUNDLE=/etc/ssl/cert.pem \
      "$_venv_py" -m pip install --no-cache-dir -q \
        --trusted-host pypi.org --trusted-host files.pythonhosted.org \
        -r "$SCRIPT_DIR/backend/scraper/requirements.txt" 2>/dev/null \
        && touch "$SCRIPT_DIR/backend/scraper/.venv/.installed" || true
    fi
  fi

  # Apply any new database migrations, regenerate Prisma client, and clear build cache
  if npx --prefix "$SCRIPT_DIR" prisma migrate deploy 2>/dev/null; then
    npx --prefix "$SCRIPT_DIR" prisma generate --no-hints 2>/dev/null || true
    rm -rf "$SCRIPT_DIR/.next"
  fi

  success "Updated to latest version!"
}

check_for_updates
install_deps
setup_env
setup_database
start_services

# ═══════════════════════════════════════════════════════════════
#  IDLE SHUTDOWN WATCHER
#  Shuts down all services after 2 minutes with no browser activity.
# ═══════════════════════════════════════════════════════════════
HEARTBEAT_FILE="/tmp/jobassist_heartbeat"
rm -f "$HEARTBEAT_FILE"

(
  # Wait for the first heartbeat (browser connected) — up to 3 minutes
  for i in $(seq 1 36); do
    [[ -f "$HEARTBEAT_FILE" ]] && break
    sleep 5
  done

  if [[ ! -f "$HEARTBEAT_FILE" ]]; then
    info "No browser activity detected after 3 minutes — shutting down"
    stop_services
  fi

  # Monitor for idle: shut down after 2 minutes without a heartbeat.
  # We capture our own PID so stop_services skips trying to kill us
  # (we'll exit naturally after calling it).
  IDLE_SECONDS=120
  WATCHER_PID=$$
  while true; do
    sleep 30
    if [[ -f "$HEARTBEAT_FILE" ]]; then
      LAST=$(date -r "$HEARTBEAT_FILE" +%s 2>/dev/null \
             || stat -f %m "$HEARTBEAT_FILE" 2>/dev/null \
             || echo 0)
      NOW=$(date +%s)
      AGE=$((NOW - LAST))
      if [[ $AGE -gt $IDLE_SECONDS ]]; then
        info "No browser activity for ${IDLE_SECONDS}s — shutting down"
        # Remove our own PID file before calling stop_services so it
        # doesn’t try to kill this subshell while it’s still running.
        rm -f "$PID_DIR/watcher.pid"
        stop_services
        exit 0
      fi
    fi
  done
) &
echo $! > "$PID_DIR/watcher.pid"
disown $!  # detach so the watcher survives terminal closure
