import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/backend/lib/prisma";
import { logger } from "@/backend/lib/logger";

const DEMO_USER_ID = process.env.DEMO_USER_ID || "demo-user-1";

// GET /api/applications
export async function GET() {
  try {
    const applications = await prisma.application.findMany({
      where: { userId: DEMO_USER_ID },
      include: { job: true },
      orderBy: { updatedAt: "desc" },
    });
    logger.debug("applications/GET", "Applications fetched", { count: applications.length });
    return NextResponse.json(applications);
  } catch (err) {
    logger.error("applications/GET", "Failed to fetch applications", err);
    return NextResponse.json({ error: "Failed to fetch applications" }, { status: 500 });
  }
}

// POST /api/applications
export async function POST(req: NextRequest) {
  try {
    const { jobId, status = "SAVED", notes } = await req.json();

    logger.info("applications/POST", "Creating/updating application", { jobId, status });

    await prisma.user.upsert({
      where: { id: DEMO_USER_ID },
      create: { id: DEMO_USER_ID, email: "demo@jobassistant.ai", name: "Demo User" },
      update: {},
    });

    const app = await prisma.application.upsert({
      where: { userId_jobId: { userId: DEMO_USER_ID, jobId } },
      create: { userId: DEMO_USER_ID, jobId, status, notes },
      update: { status, notes },
      include: { job: true },
    });

    logger.info("applications/POST", "Application saved", { id: app.id, jobId, status });
    return NextResponse.json(app);
  } catch (err) {
    logger.error("applications/POST", "Failed to save application", err);
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
