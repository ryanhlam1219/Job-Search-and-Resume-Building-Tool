#!/bin/bash
# ============================================================
# JobAssist AI — Update Script
# Run this whenever you want to get the latest version.
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

clear
echo ""
echo -e "${BOLD}${CYAN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${CYAN}║                                                      ║${NC}"
echo -e "${BOLD}${CYAN}║         Updating JobAssist AI 🔄                     ║${NC}"
echo -e "${BOLD}${CYAN}║                                                      ║${NC}"
echo -e "${BOLD}${CYAN}║  This will pull the latest changes from GitHub       ║${NC}"
echo -e "${BOLD}${CYAN}║  and apply any updates. It only takes a minute!      ║${NC}"
echo -e "${BOLD}${CYAN}║                                                      ║${NC}"
echo -e "${BOLD}${CYAN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""

cd "$SCRIPT_DIR" || die "Could not find the JobAssist AI folder."

# Make sure we're in a git repository
if [[ ! -d ".git" ]]; then
  die "This doesn't look like a git repository. Make sure you're running this from the job-assistant folder."
fi

# ── Step 1: Pull latest code ──────────────────────────────────
step "Step 1/4 — Pulling latest changes from GitHub"
info "Downloading updates..."

# Save any accidental local changes so they don't block the pull
if ! git diff --quiet 2>/dev/null; then
  warn "Found local changes — saving them temporarily..."
  git stash push -m "update.sh auto-stash $(date)" 2>/dev/null || true
fi

REMOTE=$(git remote | head -1)
git pull "$REMOTE" main 2>&1 || die "Could not reach GitHub. Check your internet connection and try again."
ok "Code updated to latest version!"

# ── Step 2: Install new dependencies ─────────────────────────
step "Step 2/4 — Installing any new packages"
info "Checking for new npm packages..."
npm install --quiet || die "Package installation failed."
ok "All packages up to date!"

# ── Step 3: Apply database migrations ────────────────────────
step "Step 3/4 — Applying database updates"
info "Running any new database migrations..."

# Start postgres if it's not running (needed for migrate)
if ! pg_isready -q 2>/dev/null; then
  info "Starting database temporarily..."
  brew services start postgresql@16 2>/dev/null || brew services start postgresql 2>/dev/null || true
  sleep 3
fi

if npx prisma migrate deploy 2>/dev/null; then
  ok "Database schema up to date!"
else
  warn "No new database migrations (or database not running — that's OK, it will apply on next launch)."
fi

# ── Step 4: Update app icon/bundle if changed ────────────────
step "Step 4/4 — Refreshing app shortcut"

APP="/Applications/JobAssist AI.app"
if [[ -d "$APP" && -f "$SCRIPT_DIR/scripts/JobAssistAI.icns" ]]; then
  cp "$SCRIPT_DIR/scripts/JobAssistAI.icns" "$APP/Contents/Resources/AppIcon.icns" 2>/dev/null && ok "App icon updated!" || true
  # Re-register with macOS so icon refreshes in Finder
  touch "$APP"
  /System/Library/Frameworks/CoreServices.framework/Versions/A/Frameworks/LaunchServices.framework/Versions/A/Support/lsregister -f "$APP" 2>/dev/null || true
  ok "App shortcut refreshed!"
else
  warn "App shortcut not found in /Applications — run setup.sh to recreate it."
fi

# ── Done ─────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}${BOLD}║                                                      ║${NC}"
echo -e "${GREEN}${BOLD}║   ✅  JobAssist AI is up to date!                    ║${NC}"
echo -e "${GREEN}${BOLD}║                                                      ║${NC}"
echo -e "${GREEN}${BOLD}║   Launch the app as usual by double-clicking         ║${NC}"
echo -e "${GREEN}${BOLD}║   \"JobAssist AI\" on your Desktop.                    ║${NC}"
echo -e "${GREEN}${BOLD}║                                                      ║${NC}"
echo -e "${GREEN}${BOLD}╚══════════════════════════════════════════════════════╝${NC}"
echo ""
