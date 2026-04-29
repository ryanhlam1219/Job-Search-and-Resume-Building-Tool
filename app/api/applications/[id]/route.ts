import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/backend/lib/prisma";

const DEMO_USER_ID = process.env.DEMO_USER_ID || "demo-user-1";

// PATCH /api/applications/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const { status, notes } = await req.json();

    const app = await prisma.application.update({
      where: { id, userId: DEMO_USER_ID },
      data: { ...(status && { status }), ...(notes !== undefined && { notes }) },
      include: { job: true },
    });

    return NextResponse.json(app);
  } catch {
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
    await prisma.application.delete({ where: { id, userId: DEMO_USER_ID } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete application" }, { status: 500 });
  }
}
