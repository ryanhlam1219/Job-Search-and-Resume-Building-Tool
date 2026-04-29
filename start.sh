#!/usr/bin/env bash
# ============================================================
# JobAssist AI — startup / stop script
# Usage:
#   ./start.sh          — install deps (if needed) and start
#   ./start.sh stop     — gracefully stop all services
# ============================================================
set -euo pipefail

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
  echo "gpt-oss:120b-cloud"
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

  for svc in next scraper ollama; do
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
  if ! command -v node &>/dev/null || [[ $(node -e "process.exit(process.version.slice(1).split('.')[0] < 20 ? 1 : 0)" 2>/dev/null; echo $?) -ne 0 ]]; then
    info "Installing Node.js 20 via Homebrew…"
    brew install node@20
    brew link node@20 --force --overwrite
  else
    success "Node.js already installed ($(node --version))"
  fi

  # ── npm ───────────────────────────────────────────────────
  if ! command -v npm &>/dev/null; then
    info "npm not found — reinstalling Node…"
    brew reinstall node@20
    brew link node@20 --force --overwrite
  else
    success "npm already installed ($(npm --version))"
  fi

  # ── Python 3.11 ───────────────────────────────────────────
  if ! command -v python3 &>/dev/null || ! python3 -c "import sys; sys.exit(0 if sys.version_info >= (3,11) else 1)" 2>/dev/null; then
    info "Installing Python 3.11 via Homebrew…"
    brew install python@3.11
    brew link python@3.11 --force --overwrite
  else
    success "Python already installed ($(python3 --version))"
  fi

  PYTHON_BIN="$(command -v python3.11 || command -v python3)"

  # ── pip / venv ────────────────────────────────────────────
  if ! "$PYTHON_BIN" -m pip --version &>/dev/null; then
    info "Installing pip…"
    "$PYTHON_BIN" -m ensurepip --upgrade
  else
    success "pip already installed"
  fi

  # ── PostgreSQL ────────────────────────────────────────────
  if ! command -v psql &>/dev/null; then
    info "Installing PostgreSQL 16 via Homebrew…"
    brew install postgresql@16
    brew link postgresql@16 --force
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
    npm install
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
  if [[ ! -f "$VENV_DIR/.installed" ]]; then
    info "Installing Python scraper dependencies…"
    "$VENV_PYTHON" -m pip install --upgrade pip -q
    "$VENV_PYTHON" -m pip install -r "$SCRAPER_DIR/requirements.txt" -q
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
  if npx prisma migrate dev --name init --skip-generate 2>&1 | grep -q "already in sync\|No pending"; then
    success "Database schema already up to date"
  else
    npx prisma generate --no-hints 2>/dev/null || npx prisma generate
    # Wipe the entire .next directory so Next.js recompiles against the new Prisma client.
    # Only .next/cache is insufficient — Turbopack's dev cache (.next/dev/cache) also
    # bundles the old client and will cause runtime errors if left behind.
    rm -rf "$SCRIPT_DIR/.next"
    success "Prisma migrations applied"
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
    ollama pull "${OLLAMA_MODEL}"
    success "Model '${OLLAMA_MODEL}' ready"
  else
    success "Ollama model '${OLLAMA_MODEL}' already present"
  fi

  # ── Python scraper ──────────────────────────────────────
  SCRAPER_DIR="$SCRIPT_DIR/backend/scraper"
  VENV_PYTHON="$SCRAPER_DIR/.venv/bin/python"
  info "Starting Python scraper on port ${SCRAPER_PORT}…"
  "$VENV_PYTHON" "$SCRAPER_DIR/app.py" \
    >"$LOG_DIR/scraper.log" 2>&1 &
  echo $! > "$PID_DIR/scraper.pid"
  # Wait briefly to confirm it started
  sleep 2
  if kill -0 "$(cat "$PID_DIR/scraper.pid")" 2>/dev/null; then
    success "Scraper started (pid $(cat "$PID_DIR/scraper.pid")), log: .logs/scraper.log"
  else
    warn "Scraper may have failed to start — check .logs/scraper.log"
  fi

  # ── Next.js app ─────────────────────────────────────────
  info "Starting Next.js on port ${APP_PORT}…"
  npm run dev -- --port "$APP_PORT" \
    >"$LOG_DIR/next.log" 2>&1 &
  echo $! > "$PID_DIR/next.pid"

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

  info "Checking for updates…"

  # Fetch with a 10s timeout so a slow connection doesn't delay startup
  if ! timeout 10 git -C "$SCRIPT_DIR" fetch origin main --quiet 2>/dev/null; then
    warn "Could not reach GitHub — skipping update check"
    return
  fi

  LOCAL=$(git -C "$SCRIPT_DIR" rev-parse HEAD 2>/dev/null)
  REMOTE=$(git -C "$SCRIPT_DIR" rev-parse origin/main 2>/dev/null)

  if [[ "$LOCAL" == "$REMOTE" ]]; then
    success "Already up to date"
    return
  fi

  info "New version available — updating…"

  # Stash any accidental local changes so they don't block the pull
  git -C "$SCRIPT_DIR" stash push -m "auto-stash $(date)" --quiet 2>/dev/null || true

  if ! git -C "$SCRIPT_DIR" pull origin main --quiet 2>/dev/null; then
    warn "Auto-update failed — continuing with current version"
    return
  fi

  # Re-install npm packages only if package.json actually changed
  if git -C "$SCRIPT_DIR" diff HEAD@{1} HEAD --name-only 2>/dev/null | grep -qE 'package\.json|package-lock\.json'; then
    info "New packages detected — installing…"
    npm --prefix "$SCRIPT_DIR" install --quiet 2>/dev/null || true
  fi

  # Apply any new database migrations
  npx --prefix "$SCRIPT_DIR" prisma migrate deploy 2>/dev/null || true

  success "Updated to latest version!"
}

check_for_updates
install_deps
setup_env
setup_database
start_services
