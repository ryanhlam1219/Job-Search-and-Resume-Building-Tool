# JobAssist AI — Production-Ready MVP

An AI-powered job discovery and application assistant with Tinder-style swiping, resume parsing, AI tailoring, and strict 1-page enforcement.

## Tech Stack

- **Frontend/Backend**: Next.js 16 (App Router) + TypeScript
- **UI**: TailwindCSS v4 + Framer Motion + Lucide Icons
- **Database**: PostgreSQL via Prisma v7
- **AI**: OpenAI GPT-4o-mini (structured JSON only)
- **Scraping**: Python 3.11 + JobSpy microservice (Flask)
- **PDF**: Puppeteer (pixel-perfect match to preview)

## Quick Start (Local)

### Prerequisites
- Node.js 20+
- PostgreSQL 14+ (or Docker)
- Python 3.11+
- OpenAI API key

### 1. Setup environment
```bash
cp .env.example .env.local
# Edit .env.local and add your OPENAI_API_KEY
```

### 2. Start PostgreSQL (Docker)
```bash
docker run -d --name postgres \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=job_assistant \
  -p 5432:5432 postgres:16-alpine
```

### 3. Run database migrations & seed
```bash
npx prisma migrate dev --name init
npm run db:seed
```

### 4. Start the Python scraper
```bash
cd scraper
pip install -r requirements.txt
python app.py
# Runs on http://localhost:8000
```

### 5. Start the Next.js app
```bash
npm run dev
# Runs on http://localhost:3000
```

## Docker Compose (Full Stack)
```bash
OPENAI_API_KEY=sk-... docker compose up
```

## Features

| Feature | Description |
|---------|-------------|
| **Job Discovery** | Scrapes LinkedIn, Indeed, Glassdoor via JobSpy |
| **Swipe UI** | Tinder-style cards with drag physics (Framer Motion) |
| **AI Matching** | GPT-powered match score (0–100) with reasons |
| **Resume Upload** | PDF → AI-parsed structured JSON |
| **Resume Editor** | Full editable form with live split-screen preview |
| **1-Page Engine** | Programmatic overflow detection + auto-adjust |
| **AI Tailoring** | Optimize resume bullets for specific job descriptions |
| **PDF Export** | Puppeteer renders the same component — pixel perfect |
| **Application Board** | Drag-and-drop Kanban (Saved → Applied → Interview → Offer) |

## Architecture

```
job-assistant/
├── app/                    # Next.js App Router
│   ├── api/
│   │   ├── jobs/           # Job listing + scrape trigger
│   │   ├── swipes/         # Record swipe actions
│   │   ├── applications/   # Track applications
│   │   ├── resume/         # Upload, parse, tailor, save
│   │   └── export-pdf/     # Puppeteer PDF generation
│   ├── page.tsx            # Dashboard
│   ├── swipe/              # Swipe interface
│   ├── resume/             # Resume editor + preview
│   └── applications/       # Kanban board
├── components/
│   ├── resume/
│   │   ├── ResumePreview.tsx   # 816×1056px preview + auto-adjust
│   │   ├── ResumeEditor.tsx    # Editable form
│   │   └── ResumeUpload.tsx    # PDF dropzone
│   └── jobs/
│       ├── SwipeInterface.tsx  # Card stack + swipe physics
│       └── ApplicationBoard.tsx # Drag-drop Kanban
├── lib/
│   ├── prisma.ts           # DB client (Prisma v7 + pg adapter)
│   ├── openai.ts           # OpenAI wrapper with retry
│   ├── types.ts            # Shared TypeScript types
│   └── utils.ts            # cn() utility
├── prisma/
│   ├── schema.prisma       # Database schema
│   └── seed.ts             # Sample data (6 jobs + resume)
└── scraper/
    ├── app.py              # Flask + JobSpy microservice
    ├── requirements.txt
    └── Dockerfile
```

## 1-Page Resume System

The `ResumePreview` component implements a constraint-based layout engine:

1. Renders at exactly 816×1056px (8.5×11 in at 96dpi)
2. Measures `scrollHeight` after render
3. If overflow: auto-adjusts in this order:
   - Reduce bullets per role (3→2→1)
   - Tighten spacing
   - Remove oldest roles
   - Reduce font size (min 10px)
4. Re-measures after each step
5. Guarantees exactly 1 page output

## API Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/jobs` | GET | List jobs (paginated) |
| `/api/jobs` | POST | Trigger scrape |
| `/api/jobs/swipeable` | GET | Jobs not yet swiped |
| `/api/jobs/[id]/match` | GET | AI match score |
| `/api/swipes` | POST | Record swipe |
| `/api/applications` | GET/POST | List/create applications |
| `/api/applications/[id]` | PATCH/DELETE | Update/remove application |
| `/api/resume` | GET/POST/PATCH | Resume CRUD |
| `/api/resume/upload` | POST | Parse PDF → raw text |
| `/api/resume/tailor` | POST | AI tailor for job |
| `/api/export-pdf` | POST | Generate PDF via Puppeteer |

## Environment Variables

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/job_assistant
OPENAI_API_KEY=sk-...
SCRAPER_SERVICE_URL=http://localhost:8000
NEXT_PUBLIC_APP_URL=http://localhost:3000
DEMO_USER_ID=demo-user-1
```
