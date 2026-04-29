import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/backend/lib/prisma";
import { logger } from "@/backend/lib/logger";

const DEMO_USER_ID = process.env.DEMO_USER_ID || "demo-user-1";

// PATCH /api/applications/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const { status, notes } = await req.json();
    logger.info("applications/PATCH", "Updating application", { id, status });

    const app = await prisma.application.update({
      where: { id, userId: DEMO_USER_ID },
      data: { ...(status && { status }), ...(notes !== undefined && { notes }) },
      include: { job: true },
    });

    logger.info("applications/PATCH", "Application updated", { id, status: app.status });
    return NextResponse.json(app);
  } catch (err) {
    logger.error("applications/PATCH", "Failed to update application", { id, err });
    return NextResponse.json({ error: "Failed to update application" }, { status: 500 });
  }
}

// DELETE /api/applications/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    logger.info("applications/DELETE", "Deleting application", { id });
    await prisma.application.delete({ where: { id, userId: DEMO_USER_ID } });
    logger.info("applications/DELETE", "Application deleted", { id });
    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error("applications/DELETE", "Failed to delete application", { id, err });
    return NextResponse.json({ error: "Failed to delete application" }, { status: 500 });
  }
}
