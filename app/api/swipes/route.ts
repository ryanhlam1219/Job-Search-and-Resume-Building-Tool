import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/backend/lib/prisma";
import type { SwipeAction } from "@/backend/lib/types";

const DEMO_USER_ID = process.env.DEMO_USER_ID || "demo-user-1";

// POST /api/swipes
export async function POST(req: NextRequest) {
  try {
    const { jobId, action }: { jobId: string; action: SwipeAction } = await req.json();

    if (!jobId || !action) {
      return NextResponse.json({ error: "jobId and action required" }, { status: 400 });
    }

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
    }

    return NextResponse.json(swipe);
  } catch (err) {
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
    return NextResponse.json(swipes);
  } catch {
    return NextResponse.json({ error: "Failed to fetch swipes" }, { status: 500 });
  }
}
