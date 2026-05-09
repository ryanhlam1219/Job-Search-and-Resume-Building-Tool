#!/bin/bash
# ============================================================
# JobAssist AI — First-Time Setup
# Run this ONCE to install everything your computer needs.
# After this, just double-click "JobAssist AI" in Applications.
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── colours ──────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
ok()   { echo -e "${GREEN}  ✓ $*${NC}"; }
info() { echo -e "${CYAN}  → $*${NC}"; }
warn() { echo -e "${YELLOW}  ! $*${NC}"; }
step() { echo -e "\n${BOLD}${CYAN}━━━  $*${NC}"; }
die()  { echo -e "\n${RED}  ✗ ERROR: $*${NC}\n" >&2; exit 1; }

say_hello() {
  clear
  echo ""
  echo -e "${BOLD}${CYAN}╔══════════════════════════════════════════════════════╗${NC}"
  echo -e "${BOLD}${CYAN}║                                                      ║${NC}"
  echo -e "${BOLD}${CYAN}║          Welcome to JobAssist AI Setup! 🎉            ║${NC}"
  echo -e "${BOLD}${CYAN}║                                                      ║${NC}"
  echo -e "${BOLD}${CYAN}║  This will install everything your Mac needs to      ║${NC}"
  echo -e "${BOLD}${CYAN}║  run JobAssist AI. It only needs to run ONCE.        ║${NC}"
  echo -e "${BOLD}${CYAN}║                                                      ║${NC}"
  echo -e "${BOLD}${CYAN}║  ⏱  Estimated time: 10-20 minutes                   ║${NC}"
  echo -e "${BOLD}${CYAN}║     (most of that is downloading — just let it run!) ║${NC}"
  echo -e "${BOLD}${CYAN}║                                                      ║${NC}"
  echo -e "${BOLD}${CYAN}╚══════════════════════════════════════════════════════╝${NC}"
  echo ""
  echo -e "  ${BOLD}What this script will install:${NC}"
  echo "  • Homebrew   — the Mac package manager (like an App Store for developers)"
  echo "  • Node.js    — the engine that runs the web app"
  echo "  • Python     — needed for job scraping"
  echo "  • PostgreSQL — a database to store your jobs & resume"
  echo "  • Ollama     — runs the AI on your computer (no internet needed!)"
  echo "  • AI model   — cloud (fast, smart) or local (offline) — your choice!"
  echo ""
  echo -e "  ${YELLOW}Press Enter to continue, or Ctrl+C to cancel.${NC}"
  read -r
}

check_macos() {
  step "Checking your Mac"
  if [[ "$(uname)" != "Darwin" ]]; then
    die "This setup is for Mac only. If you're on Windows, please ask for help."
  fi
  MACOS_VERSION=$(sw_vers -productVersion)
  ok "macOS $MACOS_VERSION detected"

  ARCH=$(uname -m)
  ok "Chip: $ARCH"
}

install_homebrew() {
  step "Step 1/7 — Homebrew (Mac package manager)"

  if command -v brew &>/dev/null; then
    ok "Homebrew is already installed!"
    return
  fi

  info "Installing Homebrew... (you may need to enter your Mac password)"
  echo ""
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" || die "Homebrew installation failed. Check your internet connection and try again."

  # Add to PATH for Apple Silicon
  if [[ -f /opt/homebrew/bin/brew ]]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
    echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> "$HOME/.zprofile"
    ok "Added Homebrew to your shell profile"
  elif [[ -f /usr/local/bin/brew ]]; then
    eval "$(/usr/local/bin/brew shellenv)"
  fi

  ok "Homebrew installed!"
}

install_node() {
  step "Step 2/7 — Node.js (web app engine)"

  if command -v node &>/dev/null; then
    NODE_VER=$(node --version)
    MAJOR=$(echo "$NODE_VER" | sed 's/v//' | cut -d. -f1)
    if [[ "$MAJOR" -ge 22 ]]; then
      ok "Node.js $NODE_VER is already installed!"
      return
    fi
    info "Upgrading Node.js from $NODE_VER to v22..."
  else
    info "Installing Node.js..."
  fi

  brew install node@22 || die "Node.js installation failed."
  brew link node@22 --force --overwrite 2>/dev/null || true

  # Make sure it's on PATH for the rest of this script
  export PATH="/opt/homebrew/opt/node@22/bin:/usr/local/opt/node@22/bin:$PATH"
  echo 'export PATH="/opt/homebrew/opt/node@22/bin:$PATH"' >> "$HOME/.zprofile"

  ok "Node.js $(node --version) installed!"
}

install_python() {
  step "Step 3/7 — Python (job scraper)"

  # Check for python3.11 specifically — a newer system python (e.g. 3.14 installed
  # as an Ollama dependency) is NOT a substitute because we pin the venv to 3.11.
  if command -v python3.11 &>/dev/null || [[ -x /opt/homebrew/bin/python3.11 ]]; then
    PY311="$(command -v python3.11 2>/dev/null || echo /opt/homebrew/bin/python3.11)"
    ok "Python $($PY311 --version 2>&1) is already installed!"
    export PATH="/opt/homebrew/opt/python@3.11/bin:/usr/local/opt/python@3.11/bin:$PATH"
    return
  fi

  info "Installing Python 3.11..."
  brew install python@3.11 || die "Python installation failed."
  brew link python@3.11 --force --overwrite 2>/dev/null || true

  # Add to PATH for the rest of this script
  export PATH="/opt/homebrew/opt/python@3.11/bin:/usr/local/opt/python@3.11/bin:$PATH"

  ok "Python installed!"
}

install_postgres() {
  step "Step 4/7 — PostgreSQL (database)"

  if command -v psql &>/dev/null; then
    ok "PostgreSQL is already installed!"
    return
  fi

  info "Installing PostgreSQL 16..."
  brew install postgresql@16 || die "PostgreSQL installation failed."
  brew link postgresql@16 --force 2>/dev/null || true

  ok "PostgreSQL installed!"
}

install_ollama() {
  step "Step 5/7 — Ollama (AI engine)"

  if command -v ollama &>/dev/null; then
    ok "Ollama is already installed!"
    return
  fi

  info "Installing Ollama..."
  brew install ollama || die "Ollama installation failed."

  ok "Ollama installed!"
}

download_ai_model() {
  step "Step 6/7 — AI model setup"
  echo ""
  echo -e "  ${CYAN}JobAssist AI needs an AI model to power resume parsing, job matching,${NC}"
  echo -e "  ${CYAN}and analysis. You have two options:${NC}"
  echo ""
  echo -e "  ${GREEN}[1] Cloud model (recommended)${NC}"
  echo -e "      Uses Ollama cloud — faster, smarter, better quality."
  echo -e "      Requires a free account at https://ollama.com (takes 30 seconds)."
  echo ""
  echo -e "  ${YELLOW}[2] Local model${NC}"
  echo -e "      Runs entirely on your computer — no account needed."
  echo -e "      Slower and less accurate, but works completely offline."
  echo ""

  local choice
  while true; do
    read -rp "  Enter 1 or 2: " choice
    case "$choice" in
      1) break ;;
      2) break ;;
      *) echo -e "  ${RED}Please enter 1 or 2.${NC}" ;;
    esac
  done

  echo ""

  # Start ollama serve temporarily
  OLLAMA_PID=""
  if ! curl -s http://localhost:11434/ &>/dev/null; then
    ollama serve &>/tmp/ollama_setup.log &
    OLLAMA_PID=$!
    sleep 3
  fi

  if [[ "$choice" == "1" ]]; then
    info "Opening Ollama login — a browser window will open. Sign up or log in, then come back here."
    echo ""
    ollama login || die "Ollama login failed. Try again or choose option 2 (local model)."
    echo ""
    info "Downloading cloud model gemma4:31b-cloud…"
    echo -e "  ${YELLOW}This may take a minute depending on your connection.${NC}"
    ollama pull gemma4:31b-cloud || die "Failed to pull cloud model. Make sure you're logged in and try again."
    # Write to .env.local so this choice persists
    if [[ -f "$SCRIPT_DIR/.env.local" ]]; then
      sed -i '' 's/^OLLAMA_MODEL=.*/OLLAMA_MODEL="gemma4:31b-cloud"/' "$SCRIPT_DIR/.env.local"
    else
      echo 'OLLAMA_MODEL="gemma4:31b-cloud"' >> "$SCRIPT_DIR/.env.local"
    fi
    ok "Cloud model ready! Using gemma4:31b-cloud"
  else
    info "Downloading local model llama3.2 (~2GB)…"
    echo -e "  ${YELLOW}This may take a few minutes. ☕ Good time for a coffee break.${NC}"
    ollama pull llama3.2 || die "Failed to download the AI model. Check your internet connection."
    # Write to .env.local so this choice persists
    if [[ -f "$SCRIPT_DIR/.env.local" ]]; then
      sed -i '' 's/^OLLAMA_MODEL=.*/OLLAMA_MODEL="llama3.2"/' "$SCRIPT_DIR/.env.local"
    else
      echo 'OLLAMA_MODEL="llama3.2"' >> "$SCRIPT_DIR/.env.local"
    fi
    ok "Local model ready! Using llama3.2"
  fi

  # Always ensure the local fallback model is present, even when the cloud model
  # was chosen. The app silently falls back to llama3.2 on 403/429 errors.
  if ! ollama list 2>/dev/null | grep -q "^llama3.2"; then
    info "Pulling local fallback model llama3.2 (~2GB)…"
    ollama pull llama3.2 2>/dev/null \
      || warn "Could not pull llama3.2 fallback — AI will only work when cloud quota is available."
  fi

  # Kill temp ollama if we started it
  [[ -n "$OLLAMA_PID" ]] && kill "$OLLAMA_PID" 2>/dev/null || true
}

install_app_deps() {
  step "Step 7/7 — Installing app dependencies"

  cd "$SCRIPT_DIR"

  # ── Node packages ──────────────────────────────────────────────────────────
  info "Installing web app packages..."
  # Use --loglevel=error to suppress engine/deprecation warnings that aren't failures
  npm install --loglevel=error || die "npm install failed."
  ok "Web app packages installed!"

  # ── Environment file ───────────────────────────────────────────────────────
  # download_ai_model() may have written OLLAMA_MODEL to .env.local already.
  # Ensure ALL required keys are present by merging from .env.example.
  if [[ ! -f "$SCRIPT_DIR/.env.local" ]]; then
    if [[ -f "$SCRIPT_DIR/.env.example" ]]; then
      cp "$SCRIPT_DIR/.env.example" "$SCRIPT_DIR/.env.local"
    else
      cat > "$SCRIPT_DIR/.env.local" <<'ENVEOF'
DATABASE_URL="postgresql://postgres:password@localhost:5432/job_assistant"
OLLAMA_BASE_URL="http://localhost:11434/v1"
OLLAMA_MODEL="llama3.2"
SCRAPER_SERVICE_URL="http://localhost:8000"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
ENVEOF
    fi
  elif [[ -f "$SCRIPT_DIR/.env.example" ]]; then
    # .env.local exists but may only contain OLLAMA_MODEL — fill in missing keys
    while IFS= read -r line; do
      KEY="$(echo "$line" | cut -d'=' -f1)"
      [[ -z "$KEY" || "$KEY" == \#* ]] && continue
      grep -q "^${KEY}=" "$SCRIPT_DIR/.env.local" 2>/dev/null || echo "$line" >> "$SCRIPT_DIR/.env.local"
    done < "$SCRIPT_DIR/.env.example"
  fi

  # ── Database ───────────────────────────────────────────────────────────────
  info "Setting up database..."
  local DB_USER="postgres" DB_PASS="password" DB_NAME="job_assistant"
  local DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}"

  # Ensure DATABASE_URL in .env.local matches what start.sh expects
  if grep -q '^DATABASE_URL=' "$SCRIPT_DIR/.env.local" 2>/dev/null; then
    sed -i '' "s|^DATABASE_URL=.*|DATABASE_URL=\"${DATABASE_URL}\"|" "$SCRIPT_DIR/.env.local"
  else
    echo "DATABASE_URL=\"${DATABASE_URL}\"" >> "$SCRIPT_DIR/.env.local"
  fi
  export DATABASE_URL

  # Start PostgreSQL if not running
  if ! pg_isready -q 2>/dev/null; then
    brew services start postgresql@16 2>/dev/null \
      || brew services start postgresql 2>/dev/null || true
    # Wait up to 20 s for it to be ready
    for _i in $(seq 1 20); do pg_isready -q 2>/dev/null && break; sleep 1; done
  fi

  if pg_isready -q 2>/dev/null; then
    # Create the 'postgres' superuser role if it doesn't exist
    # (macOS Homebrew uses the system username as default superuser, not 'postgres')
    if ! psql -d postgres -tAc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}';" 2>/dev/null | grep -q 1; then
      psql -d postgres -c \
        "CREATE ROLE ${DB_USER} WITH SUPERUSER CREATEDB CREATEROLE LOGIN PASSWORD '${DB_PASS}';" \
        2>/dev/null || true
    fi
    # Create database if it doesn't exist
    if ! psql -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}';" 2>/dev/null | grep -q 1; then
      psql -d postgres -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};" 2>/dev/null || true
    fi
    if npx prisma migrate deploy 2>/dev/null; then
      npx prisma generate --no-hints 2>/dev/null || npx prisma generate 2>/dev/null || true
    else
      warn "Migrations skipped (will apply on first launch)"
    fi
  else
    warn "PostgreSQL not ready — database setup will complete on first launch"
  fi
  ok "Database migrations applied!"

  # ── Python venv ────────────────────────────────────────────────────────────
  info "Setting up Python environment for job scraper..."

  # Resolve python3.11 explicitly — do NOT fall back to a different minor version
  # since the venv is pinned to 3.11.
  local PYTHON_BIN=""
  for _py in python3.11 /opt/homebrew/bin/python3.11 /usr/local/bin/python3.11 \
              /opt/homebrew/opt/python@3.11/bin/python3.11; do
    if command -v "$_py" &>/dev/null || [[ -x "$_py" ]]; then
      PYTHON_BIN="$(command -v "$_py" 2>/dev/null || echo "$_py")"
      break
    fi
  done
  [[ -z "$PYTHON_BIN" ]] && die "Could not find Python 3.11. Please re-run setup from the beginning."

  local VENV_DIR="$SCRIPT_DIR/backend/scraper/.venv"

  # Remove incomplete venv (e.g. from a previously failed install run)
  if [[ -d "$VENV_DIR" && ! -f "$VENV_DIR/.installed" ]]; then
    warn "Previous Python environment was incomplete — recreating..."
    rm -rf "$VENV_DIR"
  fi

  if [[ ! -d "$VENV_DIR" ]]; then
    info "Creating Python virtual environment using $PYTHON_BIN..."
    "$PYTHON_BIN" -m venv "$VENV_DIR" || die "Failed to create Python virtual environment."
  fi

  local VENV_PYTHON="$VENV_DIR/bin/python"
  [[ ! -f "$VENV_PYTHON" ]] && VENV_PYTHON="$VENV_DIR/bin/python3"
  [[ ! -f "$VENV_PYTHON" ]] && die "Virtual environment has no python binary. Delete backend/scraper/.venv and re-run setup."

  # Fix pip SSL / truststore bug on fresh macOS Python builds:
  # pip's vendored certifi may ship without its cacert.pem, causing a
  # FileNotFoundError when truststore tries to load the cert bundle.
  # Also fix the runtime certifi used by the scraper (e.g. jobspy / LinkedIn).
  # Run this unconditionally so it self-heals even on existing venvs.
  local SYSTEM_CERT="/etc/ssl/cert.pem"
  if [[ -f "$SYSTEM_CERT" ]]; then
    export SSL_CERT_FILE="$SYSTEM_CERT"
    export REQUESTS_CA_BUNDLE="$SYSTEM_CERT"

    # Fix pip's own vendored certifi
    local PIP_CERTIFI_DIR
    PIP_CERTIFI_DIR="$(
      "$VENV_PYTHON" -c \
        'import pip._vendor.certifi as c, os; print(os.path.dirname(c.__file__))' \
        2>/dev/null || echo ''
    )"
    if [[ -n "$PIP_CERTIFI_DIR" && -d "$PIP_CERTIFI_DIR" && ! -f "$PIP_CERTIFI_DIR/cacert.pem" ]]; then
      cp "$SYSTEM_CERT" "$PIP_CERTIFI_DIR/cacert.pem"
    fi

    # Fix the runtime certifi used by requests / jobspy / LinkedIn scraper
    local RUNTIME_CERTIFI_DIR
    RUNTIME_CERTIFI_DIR="$(
      "$VENV_PYTHON" -c \
        'import certifi, os; print(os.path.dirname(certifi.__file__))' \
        2>/dev/null || echo ''
    )"
    if [[ -n "$RUNTIME_CERTIFI_DIR" && -d "$RUNTIME_CERTIFI_DIR" && ! -f "$RUNTIME_CERTIFI_DIR/cacert.pem" ]]; then
      cp "$SYSTEM_CERT" "$RUNTIME_CERTIFI_DIR/cacert.pem"
    fi
  fi

  if [[ ! -f "$VENV_DIR/.installed" ]]; then
    "$VENV_PYTHON" -m pip install --upgrade pip --no-cache-dir -q \
      --trusted-host pypi.org --trusted-host files.pythonhosted.org --trusted-host pypi.python.org
    "$VENV_PYTHON" -m pip install --no-cache-dir -q \
      --trusted-host pypi.org --trusted-host files.pythonhosted.org --trusted-host pypi.python.org \
      -r "$SCRIPT_DIR/backend/scraper/requirements.txt"
    touch "$VENV_DIR/.installed"
  fi
  ok "Job scraper dependencies installed!"
}

create_app_shortcut() {
  step "Creating the JobAssist AI app in your Applications folder"

  APP="/Applications/JobAssist AI.app"

  # Build the .app bundle
  rm -rf "$APP"
  mkdir -p "$APP/Contents/MacOS"
  mkdir -p "$APP/Contents/Resources"

  # Copy icon if it exists
  if [[ -f "$SCRIPT_DIR/scripts/JobAssistAI.icns" ]]; then
    cp "$SCRIPT_DIR/scripts/JobAssistAI.icns" "$APP/Contents/Resources/AppIcon.icns"
    ICON_KEY='<key>CFBundleIconFile</key><string>AppIcon</string>'
  else
    ICON_KEY=""
  fi

  cat > "$APP/Contents/Info.plist" << PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleExecutable</key>
  <string>launcher</string>
  <key>CFBundleIdentifier</key>
  <string>com.jobassist.ai</string>
  <key>CFBundleName</key>
  <string>JobAssist AI</string>
  <key>CFBundleDisplayName</key>
  <string>JobAssist AI</string>
  <key>CFBundleVersion</key>
  <string>1.0.0</string>
  <key>CFBundleShortVersionString</key>
  <string>1.0</string>
  <key>CFBundleIconFile</key>
  <string>AppIcon</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>LSMinimumSystemVersion</key>
  <string>12.0</string>
  <key>NSHighResolutionCapable</key>
  <true/>
</dict>
</plist>
PLIST

  # Write the launcher that knows where this project lives
  cat > "$APP/Contents/MacOS/launcher" << LAUNCHER_SCRIPT
#!/bin/bash
SCRIPT_DIR="$SCRIPT_DIR"

if [[ ! -f "\$SCRIPT_DIR/start.sh" ]]; then
  osascript -e 'display dialog "Could not find the JobAssist AI folder at: '"$SCRIPT_DIR"'\n\nPlease contact Ryan for help." buttons {"OK"} default button "OK" with title "JobAssist AI" with icon stop'
  exit 1
fi

# Already running? Just open the browser.
if curl -s http://localhost:3000 >/dev/null 2>&1; then
  open "http://localhost:3000"
  exit 0
fi

# Open a minimized Terminal window to run start.sh (ensures proper process group / pty)
osascript << 'APPLESCRIPT'
tell application "Terminal"
  set win to do script "cd \"SCRIPT_DIR_PLACEHOLDER\" && bash start.sh; exit"
  tell win to set miniaturized to true
end tell
APPLESCRIPT

# Poll until Next.js is ready (up to 90s), then open browser exactly once
for i in \$(seq 1 90); do
  if curl -s http://localhost:3000 >/dev/null 2>&1; then
    open "http://localhost:3000"
    exit 0
  fi
  sleep 1
done

# Timed out — surface the Terminal so the user can see what went wrong
osascript -e 'tell application "Terminal" to activate'
LAUNCHER_SCRIPT

  # Substitute the real SCRIPT_DIR into the heredoc placeholder
  sed -i '' "s|SCRIPT_DIR_PLACEHOLDER|$SCRIPT_DIR|g" "$APP/Contents/MacOS/launcher"

  chmod +x "$APP/Contents/MacOS/launcher"

  # Register with Launch Services so the icon shows immediately
  touch "$APP"
  /System/Library/Frameworks/CoreServices.framework/Versions/A/Frameworks/LaunchServices.framework/Versions/A/Support/lsregister -f "$APP" 2>/dev/null || true

  ok "\"JobAssist AI\" created in /Applications!"

  # Also add an alias on the Desktop
  osascript -e "tell application \"Finder\" to make alias file to POSIX file \"$APP\" at POSIX file \"$HOME/Desktop\"" >/dev/null 2>&1 && ok "Shortcut added to Desktop!" || true
}

print_done() {
  echo ""
  echo -e "${GREEN}${BOLD}╔══════════════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}${BOLD}║                                                      ║${NC}"
  echo -e "${GREEN}${BOLD}║   🎉  Setup complete! JobAssist AI is ready!          ║${NC}"
  echo -e "${GREEN}${BOLD}║                                                      ║${NC}"
  echo -e "${GREEN}${BOLD}║   How to use it:                                     ║${NC}"
  echo -e "${GREEN}${BOLD}║   1. Look for \"JobAssist AI\" on your Desktop          ║${NC}"
  echo -e "${GREEN}${BOLD}║      or in Applications                              ║${NC}"
  echo -e "${GREEN}${BOLD}║   2. Double-click it to start!                       ║${NC}"
  echo -e "${GREEN}${BOLD}║   3. A terminal window will open briefly while       ║${NC}"
  echo -e "${GREEN}${BOLD}║      it starts, then your browser opens the app.    ║${NC}"
  echo -e "${GREEN}${BOLD}║                                                      ║${NC}"
  echo -e "${GREEN}${BOLD}║   The first launch takes ~30 seconds. After that    ║${NC}"
  echo -e "${GREEN}${BOLD}║   it's faster each time!                            ║${NC}"
  echo -e "${GREEN}${BOLD}║                                                      ║${NC}"
  echo -e "${GREEN}${BOLD}╚══════════════════════════════════════════════════════╝${NC}"
  echo ""
}

create_update_shortcut() {
  step "Creating the Update shortcut"

  UPDATE_APP="/Applications/Update JobAssist AI.app"
  rm -rf "$UPDATE_APP"
  mkdir -p "$UPDATE_APP/Contents/MacOS"
  mkdir -p "$UPDATE_APP/Contents/Resources"

  cat > "$UPDATE_APP/Contents/Info.plist" << PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleExecutable</key>
  <string>launcher</string>
  <key>CFBundleIdentifier</key>
  <string>com.jobassist.ai.update</string>
  <key>CFBundleName</key>
  <string>Update JobAssist AI</string>
  <key>CFBundleDisplayName</key>
  <string>Update JobAssist AI</string>
  <key>CFBundleVersion</key>
  <string>1.0.0</string>
  <key>CFBundleShortVersionString</key>
  <string>1.0</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>LSMinimumSystemVersion</key>
  <string>12.0</string>
  <key>NSHighResolutionCapable</key>
  <true/>
</dict>
</plist>
PLIST

  cat > "$UPDATE_APP/Contents/MacOS/launcher" << UPDATE_LAUNCHER
#!/bin/bash
SCRIPT_DIR="$SCRIPT_DIR"

if [[ ! -f "\$SCRIPT_DIR/update.sh" ]]; then
  osascript -e 'display dialog "Could not find update.sh at: '"$SCRIPT_DIR"'\n\nPlease contact Ryan for help." buttons {"OK"} default button "OK" with title "Update JobAssist AI" with icon stop'
  exit 1
fi

osascript << OSASCRIPT
tell application "Terminal"
  activate
  set win to do script "cd \"\$SCRIPT_DIR\" && bash update.sh"
  tell win
    set custom title to "Update JobAssist AI"
  end tell
end tell
OSASCRIPT
UPDATE_LAUNCHER

  chmod +x "$UPDATE_APP/Contents/MacOS/launcher"
  touch "$UPDATE_APP"
  /System/Library/Frameworks/CoreServices.framework/Versions/A/Frameworks/LaunchServices.framework/Versions/A/Support/lsregister -f "$UPDATE_APP" 2>/dev/null || true

  ok "\"Update JobAssist AI\" created in /Applications!"
}

# ── RUN ──────────────────────────────────────────────────────
say_hello
check_macos
install_homebrew
install_node
install_python
install_postgres
install_ollama
download_ai_model
install_app_deps
create_app_shortcut
create_update_shortcut
print_done
