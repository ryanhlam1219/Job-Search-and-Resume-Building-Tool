# JobAssist AI

An AI-powered job discovery and application assistant with Tinder-style swiping, resume editing with live preview, AI tailoring, and a strict 1-page enforcement engine. Runs fully locally — no API keys or cloud services required.

---

## For Non-Developers (First-Time Setup)

If this is your first time setting up the app on a Mac:

1. **Open Terminal** — press `Cmd + Space`, type `Terminal`, press Enter
2. **Run this one command:**
   ```
   cd ~/Desktop/job-assistant && bash setup.sh
   ```
3. Follow the on-screen instructions (friendly prompts walk you through everything)
4. When done, double-click **JobAssist AI** on your Desktop to launch

> ⏱ The setup takes 10–20 minutes, mostly downloading the AI model (~2 GB). Just let it run!

### Updating the App

To get the latest version, double-click **Update JobAssist AI** in your Applications folder (created by setup). It pulls the newest code from GitHub, updates packages, and applies any database changes automatically.

Or run in Terminal from the job-assistant folder:
```
bash update.sh
```

> The GitHub repository must be public for updates to work without a password.

## Launching (After Setup)

Double-click **JobAssist AI** on your Desktop. A terminal window opens briefly while services start, then your browser opens to the app automatically.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend / Backend | Next.js 16 (App Router) + TypeScript |
| UI | Tailwind CSS v4 + Framer Motion v12 + Lucide Icons |
| Database | PostgreSQL 16 via Prisma v7 |
| AI | Ollama (local — no API key needed), llama3.2 default |
| Scraping | Python 3.11 + JobSpy microservice (Flask) |
| PDF Export | Puppeteer (pixel-perfect match to screen preview) |

---

## Features

| Feature | Description |
|---------|-------------|
| **Job Discovery** | Scrapes LinkedIn, Indeed, Glassdoor via JobSpy |
| **Swipe UI** | Tinder-style cards with drag physics (Framer Motion) |
| **AI Matching** | Local LLM match score (0–100) with reasons |
| **AI Analysis Panel** | Per-job breakdown with inline AI chat |
| **Resume Upload** | PDF → AI-parsed structured JSON |
| **Resume Editor** | Full editable form with live split-screen preview |
| **1-Page Engine** | Programmatic overflow detection + auto-adjust |
| **AI Tailoring** | Optimize resume bullets for a specific job description |
| **PDF Export** | Puppeteer renders the same component — pixel perfect |
| **Application Board** | Drag-and-drop Kanban (Saved → Applied → Interview → Offer) |
| **Dark / Light Mode** | Toggle in the nav bar, persisted across sessions |

---

## Developer Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL 16+
- Python 3.11+
- [Ollama](https://ollama.com) with `llama3.2` pulled

### 1. Set up environment
```bash
cp .env.example .env.local
# Defaults work out of the box with a local setup; no API key required
```

### 2. Install dependencies
```bash
npm install
```

### 3. Start PostgreSQL and run migrations
```bash
# Homebrew-installed PostgreSQL:
brew services start postgresql@16
npx prisma migrate deploy
```

### 4. Start the Python scraper
```bash
cd backend/scraper
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python app.py
# Runs on http://localhost:8000
```

### 5. Start Ollama and pull the model
```bash
ollama serve
# In another terminal:
ollama pull llama3.2
```

### 6. Start the Next.js app
```bash
npm run dev
# Runs on http://localhost:3000
```

Or use the all-in-one startup script:
```bash
bash start.sh
```

## Docker Compose (Alternative)

```bash
docker compose up
```

Starts PostgreSQL, the scraper, and Next.js. Ollama must still run natively (hardware passthrough is required for GPU acceleration on Apple Silicon).

---

## Environment Variables

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/job_assistant

# Ollama — no API key required, runs locally
OLLAMA_BASE_URL=http://localhost:11434/v1
OLLAMA_MODEL=llama3.2

SCRAPER_SERVICE_URL=http://localhost:8000
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Single-user MVP
DEMO_USER_ID=demo-user-1
```

---

## Project Structure

```
job-assistant/
├── app/                        # Next.js App Router
│   ├── api/
│   │   ├── jobs/               # Job listing + scrape trigger
│   │   │   └── [id]/analyze/   # Per-job AI analysis
│   │   ├── swipes/             # Record swipe actions
│   │   ├── applications/       # Track applications
│   │   ├── resume/             # Upload, parse, tailor, save
│   │   └── export-pdf/         # Puppeteer PDF generation
│   ├── page.tsx                # Jobs dashboard
│   ├── swipe/                  # Swipe interface
│   ├── resume/                 # Resume editor + preview + print
│   └── applications/           # Kanban board
├── frontend/
│   ├── components/
│   │   ├── jobs/
│   │   │   ├── SwipeInterface.tsx      # Card stack + swipe physics
│   │   │   ├── ApplicationBoard.tsx    # Drag-drop Kanban
│   │   │   └── JobAnalysisModal.tsx    # AI analysis + chat panel
│   │   ├── resume/
│   │   │   ├── ResumePreview.tsx       # 816×1056px preview + auto-adjust
│   │   │   ├── ResumeEditor.tsx        # Editable form
│   │   │   └── ResumeUpload.tsx        # PDF dropzone
│   │   └── layout/
│   │       └── Navigation.tsx          # Nav bar + dark/light toggle
│   └── styles/
│       └── globals.css                 # Tailwind v4 + theme variables
├── backend/
│   ├── lib/
│   │   ├── prisma.ts           # DB client (Prisma v7 + pg adapter)
│   │   ├── openai.ts           # Ollama client (local LLM, no API key)
│   │   ├── types.ts            # Shared TypeScript types
│   │   └── utils.ts            # cn() and helpers
│   └── scraper/
│       ├── app.py              # Flask + JobSpy microservice
│       └── requirements.txt
├── prisma/
│   ├── schema.prisma           # Database schema
│   └── seed.ts                 # Sample data
├── scripts/
│   ├── app-icon.svg            # Source icon
│   └── JobAssistAI.icns        # Compiled macOS icon set
├── setup.sh                    # First-time installer (non-developers)
├── update.sh                   # Pull latest + apply updates
└── start.sh                    # Launch all services
```

---

## 1-Page Resume System

The `ResumePreview` component implements a constraint-based layout engine:

1. Renders at exactly 816×1056 px (8.5×11 in at 96 dpi)
2. Measures `scrollHeight` after each render
3. If content overflows, auto-adjusts in order:
   - Reduce bullets per role (3 → 2 → 1)
   - Tighten spacing
   - Remove oldest roles
   - Reduce font size (minimum 10 px)
4. Re-measures after each step
5. Guarantees exactly 1 page in the exported PDF

---

## API Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/jobs` | GET | List jobs (paginated, filterable) |
| `/api/jobs` | POST | Trigger job scrape |
| `/api/jobs/swipeable` | GET | Jobs not yet swiped |
| `/api/jobs/[id]/analyze` | GET | AI analysis for a job |
| `/api/jobs/[id]/match` | GET | AI match score |
| `/api/swipes` | POST | Record swipe left/right |
| `/api/applications` | GET / POST | List / create applications |
| `/api/applications/[id]` | PATCH / DELETE | Update / remove application |
| `/api/resume` | GET / POST / PATCH | Resume CRUD |
| `/api/resume/upload` | POST | Parse PDF → structured JSON |
| `/api/resume/tailor` | POST | AI tailor resume for a job |
| `/api/resume/review` | POST | AI review and suggestions |
| `/api/export-pdf` | POST | Generate PDF via Puppeteer |
