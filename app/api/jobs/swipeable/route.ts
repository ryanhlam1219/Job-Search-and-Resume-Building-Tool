import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/backend/lib/prisma";
import { logger } from "@/backend/lib/logger";

const DEMO_USER_ID = process.env.DEMO_USER_ID || "demo-user-1";

// GET /api/jobs/swipeable — jobs not yet swiped by user
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get("limit") || "10");
  const remote = searchParams.get("remote") === "true";
  const hasSalary = searchParams.get("hasSalary") === "true";

  try {
    const swipedIds = await prisma.swipe.findMany({
      where: { userId: DEMO_USER_ID },
      select: { jobId: true },
    });

    const swipedSet = swipedIds.map((s) => s.jobId);

    const jobs = await prisma.job.findMany({
      where: {
        id: { notIn: swipedSet.length > 0 ? swipedSet : undefined },
        ...(remote && { location: { contains: "remote", mode: "insensitive" as const } }),
        ...(hasSalary && { salary: { not: null } }),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    logger.info("jobs/swipeable/GET", "Swipeable jobs fetched", {
      limit,
      remote,
      hasSalary,
      swipedAlready: swipedSet.length,
      returned: jobs.length,
    });
    return NextResponse.json(jobs);
  } catch (err) {
    logger.error("jobs/swipeable/GET", "Failed to fetch swipeable jobs", err);
    return NextResponse.json({ error: "Failed to fetch swipeable jobs" }, { status: 500 });
  }
}

// DELETE /api/jobs/swipeable — purge all discover jobs and related rows
export async function DELETE() {
  logger.warn("jobs/swipeable/DELETE", "Purging all discover jobs");
  try {
    const jobIds = await prisma.job.findMany({
      select: { id: true },
    });

    const ids = jobIds.map((j) => j.id);
    if (ids.length === 0) {
      logger.info("jobs/swipeable/DELETE", "Nothing to purge");
      return NextResponse.json({ deletedJobs: 0, deletedSwipes: 0, deletedApplications: 0 });
    }

    const [deletedSwipes, deletedApplications, deletedJobs] = await prisma.$transaction([
      prisma.swipe.deleteMany({ where: { jobId: { in: ids } } }),
      prisma.application.deleteMany({ where: { jobId: { in: ids } } }),
      prisma.job.deleteMany({ where: { id: { in: ids } } }),
    ]);

    logger.info("jobs/swipeable/DELETE", "Purge complete", {
      deletedJobs: deletedJobs.count,
      deletedSwipes: deletedSwipes.count,
      deletedApplications: deletedApplications.count,
    });
    return NextResponse.json({
      deletedJobs: deletedJobs.count,
      deletedSwipes: deletedSwipes.count,
      deletedApplications: deletedApplications.count,
    });
  } catch (err) {
    logger.error("jobs/swipeable/DELETE", "Purge failed", err);
    return NextResponse.json({ error: "Failed to purge discover jobs" }, { status: 500 });
  }
}
