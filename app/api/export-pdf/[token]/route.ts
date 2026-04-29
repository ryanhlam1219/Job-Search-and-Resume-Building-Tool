import { NextResponse } from "next/server";
import { getPdfExportPayload } from "@/backend/lib/pdf-export-store";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const resumeData = getPdfExportPayload(token);

  if (!resumeData) {
    return NextResponse.json({ error: "PDF export payload not found" }, { status: 404 });
  }

  return NextResponse.json({ resumeData });
}