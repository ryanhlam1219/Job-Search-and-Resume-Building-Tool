import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/backend/lib/prisma";
import { callOpenAI } from "@/backend/lib/openai";

// GET /api/jobs/[id]/match — compute match score
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const resumeId = req.nextUrl.searchParams.get("resumeId");

  if (!resumeId) {
    return NextResponse.json({ error: "resumeId required" }, { status: 400 });
  }

  try {
    const [job, resume] = await Promise.all([
      prisma.job.findUnique({ where: { id } }),
      prisma.resume.findUnique({ where: { id: resumeId } }),
    ]);

    if (!job || !resume) {
      return NextResponse.json({ error: "Job or resume not found" }, { status: 404 });
    }

    const resumeData = resume.data as Record<string, unknown>;

    const result = await callOpenAI<{ match_score: number; reasons: string[] }>(
      `You are a job matching engine. Analyze the resume vs job description.
Return JSON: { "match_score": <0-100>, "reasons": ["reason1", "reason2", "reason3"] }
Be concise. Focus on skills, title, experience level.`,
      `RESUME:\n${JSON.stringify(resumeData, null, 2)}\n\nJOB:\nTitle: ${job.title}\nCompany: ${job.company}\nDescription: ${job.description.slice(0, 2000)}`
    );

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ match_score: 0, reasons: ["Could not compute match"] });
  }
}
