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
  echo "  • llama3.2   — the AI language model (~2 GB download)"
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
    if [[ "$MAJOR" -ge 20 ]]; then
      ok "Node.js $NODE_VER is already installed!"
      return
    fi
    info "Upgrading Node.js from $NODE_VER to v20..."
  else
    info "Installing Node.js..."
  fi

  brew install node@20 || die "Node.js installation failed."
  brew link node@20 --force --overwrite 2>/dev/null || true

  # Make sure it's on PATH
  export PATH="/opt/homebrew/opt/node@20/bin:/usr/local/opt/node@20/bin:$PATH"
  echo 'export PATH="/opt/homebrew/opt/node@20/bin:$PATH"' >> "$HOME/.zprofile"

  ok "Node.js $(node --version) installed!"
}

install_python() {
  step "Step 3/7 — Python (job scraper)"

  if command -v python3 &>/dev/null && python3 -c "import sys; sys.exit(0 if sys.version_info >= (3,11) else 1)" 2>/dev/null; then
    ok "Python $(python3 --version) is already installed!"
    return
  fi

  info "Installing Python 3.11..."
  brew install python@3.11 || die "Python installation failed."
  brew link python@3.11 --force --overwrite 2>/dev/null || true

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
  step "Step 6/7 — Downloading AI model (deepseek-v4-flash:cloud)"
  echo ""
  echo -e "  ${YELLOW}This may take a few minutes depending on your connection.${NC}"
  echo "  The progress bar will appear below. Just let it run!"
  echo "  ☕ Good time for a coffee break."
  echo ""

  # Start ollama serve temporarily to pull the model
  if ! curl -s http://localhost:11434/ &>/dev/null; then
    ollama serve &>/tmp/ollama_setup.log &
    OLLAMA_PID=$!
    sleep 3
  fi

  ollama pull deepseek-v4-flash:cloud || die "Failed to download the AI model. Check your internet connection."

  # Kill temp ollama if we started it
  kill "$OLLAMA_PID" 2>/dev/null || true

  ok "AI model downloaded!"
}

install_app_deps() {
  step "Step 7/7 — Installing app dependencies"

  cd "$SCRIPT_DIR"

  info "Installing web app packages..."
  npm install --quiet || die "npm install failed."
  ok "Web app packages installed!"

  info "Applying database migrations…"
  # Start postgres temporarily if not running
  if ! pg_isready -q 2>/dev/null; then
    brew services start postgresql@16 2>/dev/null || brew services start postgresql 2>/dev/null || true
    sleep 3
  fi
  export DATABASE_URL="postgresql://jobassist:jobassist@localhost:5432/jobassist"
  npx prisma migrate deploy 2>/dev/null || warn "Migrations skipped (database may not be running yet — will apply on first launch)"
  npx prisma generate --no-hints 2>/dev/null || npx prisma generate 2>/dev/null || true
  ok "Database migrations applied!"

  info "Setting up Python environment for job scraper..."
  PYTHON_BIN="$(command -v python3.11 || command -v python3.12 || command -v python3.13 || command -v python3.14 || command -v python3)"
  VENV_DIR="$SCRIPT_DIR/backend/scraper/.venv"

  if [[ -z "$PYTHON_BIN" ]]; then
    die "Could not find a Python 3 installation. Please install Python 3 and try again."
  fi

  # Delete broken venv if it exists but has no python binary
  if [[ -d "$VENV_DIR" && ! -f "$VENV_DIR/bin/python" && ! -f "$VENV_DIR/bin/python3" ]]; then
    warn "Removing broken virtual environment, recreating..."
    rm -rf "$VENV_DIR"
  fi

  if [[ ! -d "$VENV_DIR" ]]; then
    info "Creating Python virtual environment using $PYTHON_BIN..."
    "$PYTHON_BIN" -m venv "$VENV_DIR" || die "Failed to create Python virtual environment. Try running: $PYTHON_BIN -m venv $VENV_DIR"
  fi

  # Use whichever python binary the venv created
  VENV_PYTHON="$VENV_DIR/bin/python"
  [[ ! -f "$VENV_PYTHON" ]] && VENV_PYTHON="$VENV_DIR/bin/python3"
  [[ ! -f "$VENV_PYTHON" ]] && die "Virtual environment was created but has no python binary. Try deleting backend/scraper/.venv and running setup again."

  "$VENV_PYTHON" -m pip install --upgrade pip -q
  "$VENV_PYTHON" -m pip install -r "$SCRIPT_DIR/backend/scraper/requirements.txt" -q
  touch "$VENV_DIR/.installed"
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

# Run start.sh silently in background
bash "\$SCRIPT_DIR/start.sh" > /tmp/jobassist_launch.log 2>&1 &

# Poll until Next.js is ready (up to 90s), then open browser exactly once
for i in \$(seq 1 90); do
  if curl -s http://localhost:3000 >/dev/null 2>&1; then
    open "http://localhost:3000"
    break
  fi
  sleep 1
done
LAUNCHER_SCRIPT

  chmod +x "$APP/Contents/MacOS/launcher"

  # Register with Launch Services so the icon shows immediately
  touch "$APP"
  /System/Library/Frameworks/CoreServices.framework/Versions/A/Frameworks/LaunchServices.framework/Versions/A/Support/lsregister -f "$APP" 2>/dev/null || true

  ok "\"JobAssist AI\" created in /Applications!"

  # Also add an alias on the Desktop
  osascript -e "tell application \"Finder\" to make alias file to POSIX file \"$APP\" at POSIX file \"$HOME/Desktop\"" 2>/dev/null && ok "Shortcut added to Desktop!" || true
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
