import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/backend/lib/prisma";
import { logger } from "@/backend/lib/logger";

const DEMO_USER_ID = process.env.DEMO_USER_ID || "demo-user-1";

async function ensureDemoUser() {
  await prisma.user.upsert({
    where: { id: DEMO_USER_ID },
    create: { id: DEMO_USER_ID, email: "demo@jobassistant.ai", name: "Demo User" },
    update: {},
  });
}

// GET /api/jobs — list jobs with optional search/filter
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const skip = (page - 1) * limit;
  const search = searchParams.get("search")?.trim() || "";
  const location = searchParams.get("location")?.trim() || "";
  const source = searchParams.get("source")?.trim() || "";
  const remote = searchParams.get("remote") === "true";
  const hasSalary = searchParams.get("hasSalary") === "true";

  const where = {
    ...(search && {
      OR: [
        { title: { contains: search, mode: "insensitive" as const } },
        { company: { contains: search, mode: "insensitive" as const } },
      ],
    }),
    ...(location && { location: { contains: location, mode: "insensitive" as const } }),
    ...(source && { source: { equals: source, mode: "insensitive" as const } }),
    ...(remote && { location: { contains: "remote", mode: "insensitive" as const } }),
    ...(hasSalary && { salary: { not: null } }),
  };

  logger.debug("jobs/GET", "Fetching jobs", { page, limit, search, location, source, remote, hasSalary });

  try {
    const [jobs, total] = await Promise.all([
      prisma.job.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.job.count({ where }),
    ]);

    logger.info("jobs/GET", "Jobs fetched", { total, returned: jobs.length, page });
    return NextResponse.json({ jobs, total, page, limit });
  } catch (err) {
    logger.error("jobs/GET", "Failed to fetch jobs", err);
    return NextResponse.json({ error: "Failed to fetch jobs" }, { status: 500 });
  }
}

// POST /api/jobs — trigger scrape and store
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { search_term = "software engineer", location = "United States", results_wanted = 50 } = body;

    const scraperUrl = process.env.SCRAPER_SERVICE_URL || "http://localhost:8000";
    const params = new URLSearchParams({ search_term, location, results_wanted: String(results_wanted) });

    logger.info("jobs/POST", "Triggering scrape", { search_term, location, results_wanted });

    const scraperRes = await fetch(`${scraperUrl}/scrape-jobs?${params}`, {
      signal: AbortSignal.timeout(120000),
    });

    if (!scraperRes.ok) {
      throw new Error(`Scraper returned ${scraperRes.status}`);
    }

    const scraped: Array<{
      title: string;
      company: string;
      location: string;
      description: string;
      salary: string;
      source: string;
      url: string;
      date_posted: string | null;
    }> = await scraperRes.json();

    logger.debug("jobs/POST", "Scraper returned results", { count: scraped.length });

    let created = 0;
    for (const job of scraped) {
      if (!job.url) continue;
      try {
        await prisma.job.upsert({
          where: { url: job.url },
          create: {
            title: job.title,
            company: job.company,
            description: job.description || "",
            location: job.location || null,
            salary: job.salary || null,
            source: job.source,
            url: job.url,
            postedAt: job.date_posted ? new Date(job.date_posted) : null,
          },
          update: {},
        });
        created++;
      } catch {
        // Skip duplicates
      }
    }

    await ensureDemoUser();

    logger.info("jobs/POST", "Scrape complete", { scraped: scraped.length, created });
    return NextResponse.json({ message: `Scraped and stored ${created} jobs`, total: created });
  } catch (err) {
    logger.error("jobs/POST", "Scrape failed", err);
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
