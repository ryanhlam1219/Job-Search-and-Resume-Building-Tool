import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/backend/lib/prisma";
import { logger } from "@/backend/lib/logger";
import type { SwipeAction } from "@/backend/lib/types";

const DEMO_USER_ID = process.env.DEMO_USER_ID || "demo-user-1";

// POST /api/swipes
export async function POST(req: NextRequest) {
  try {
    const { jobId, action }: { jobId: string; action: SwipeAction } = await req.json();

    if (!jobId || !action) {
      return NextResponse.json({ error: "jobId and action required" }, { status: 400 });
    }

    logger.info("swipes/POST", "Recording swipe", { jobId, action });

    await prisma.user.upsert({
      where: { id: DEMO_USER_ID },
      create: { id: DEMO_USER_ID, email: "demo@jobassistant.ai", name: "Demo User" },
      update: {},
    });

    const swipe = await prisma.swipe.upsert({
      where: { userId_jobId: { userId: DEMO_USER_ID, jobId } },
      create: { userId: DEMO_USER_ID, jobId, action },
      update: { action },
    });

    // Auto-create application for INTERESTED / HIGH_PRIORITY
    if (action === "INTERESTED" || action === "HIGH_PRIORITY") {
      await prisma.application.upsert({
        where: { userId_jobId: { userId: DEMO_USER_ID, jobId } },
        create: {
          userId: DEMO_USER_ID,
          jobId,
          status: "SAVED",
          notes: action === "HIGH_PRIORITY" ? "⭐ High Priority" : undefined,
        },
        update: {},
      });
      logger.info("swipes/POST", "Application auto-created", { jobId, action });
    }

    logger.debug("swipes/POST", "Swipe saved", { swipeId: swipe.id, jobId, action });
    return NextResponse.json(swipe);
  } catch (err) {
    logger.error("swipes/POST", "Failed to record swipe", err);
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE /api/swipes — undo a swipe (removes the swipe record so the card reappears on next load)
export async function DELETE(req: NextRequest) {
  try {
    const { jobId }: { jobId: string } = await req.json();

    if (!jobId) {
      return NextResponse.json({ error: "jobId required" }, { status: 400 });
    }

    logger.info("swipes/DELETE", "Undoing swipe", { jobId });

    await prisma.swipe.deleteMany({
      where: { userId: DEMO_USER_ID, jobId },
    });

    // Also remove the auto-created application if it's still in SAVED status
    await prisma.application.deleteMany({
      where: { userId: DEMO_USER_ID, jobId, status: "SAVED" },
    });

    logger.info("swipes/DELETE", "Swipe undone", { jobId });
    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error("swipes/DELETE", "Failed to undo swipe", err);
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// GET /api/swipes
export async function GET() {
  try {
    const swipes = await prisma.swipe.findMany({
      where: { userId: DEMO_USER_ID },
      include: { job: true },
      orderBy: { createdAt: "desc" },
    });
    logger.debug("swipes/GET", "Swipes fetched", { count: swipes.length });
    return NextResponse.json(swipes);
  } catch (err) {
    logger.error("swipes/GET", "Failed to fetch swipes", err);
    return NextResponse.json({ error: "Failed to fetch swipes" }, { status: 500 });
  }
}
