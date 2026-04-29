import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/backend/lib/prisma";
import { callOpenAIChat } from "@/backend/lib/openai";
import type { JobAnalysis, ResumeData } from "@/backend/lib/types";

const DEMO_USER_ID = process.env.DEMO_USER_ID || "demo-user-1";

const CHAT_SYSTEM_PROMPT = `You are a friendly, expert career coach helping a job seeker understand their AI job analysis and plan their next steps.

You have access to:
- The job description they're targeting
- Their current resume
- The AI analysis (match score, strengths, gaps, development plan, suggested edits)

Your role:
- Answer follow-up questions about the analysis in a clear, encouraging, and practical way
- Dive deeper into any skill gap or development path on request
- Suggest specific, actionable next steps
- Help them understand WHY certain resume changes would improve their chances
- Be honest but supportive — acknowledge strengths while being direct about gaps

Format your responses with markdown:
- Use **bold** for key skills, action items, or important terms
- Use bullet lists for steps or recommendations
- Use ## headers for longer responses with multiple sections
- Keep responses focused and scannable — avoid walls of text`;

// POST /api/jobs/[id]/chat
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const { message, history, analysis } = await req.json() as {
      message: string;
      history: Array<{ role: "user" | "assistant"; content: string }>;
      analysis: JobAnalysis | null;
    };

    if (!message?.trim()) {
      return NextResponse.json({ error: "Message required" }, { status: 400 });
    }

    const job = await prisma.job.findUnique({ where: { id } });
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const resume = await prisma.resume.findFirst({
      where: { userId: DEMO_USER_ID },
      orderBy: { updatedAt: "desc" },
    });

    const resumeData = resume?.data as ResumeData | null;

    // Context block injected once at the top of the conversation
    const contextBlock = [
      `JOB: ${job.title} at ${job.company}`,
      `LOCATION: ${job.location ?? "Not specified"}`,
      "",
      "JOB DESCRIPTION:",
      job.description.slice(0, 1500),
      "",
      resumeData
        ? `CANDIDATE RESUME (summary):\n${JSON.stringify({ name: resumeData.name, title: resumeData.title, skills: resumeData.skills, experience: resumeData.experience?.map((e) => ({ role: e.role, company: e.company })) }, null, 2)}`
        : "CANDIDATE RESUME: Not uploaded",
      "",
      analysis
        ? `AI ANALYSIS:\nMatch score: ${analysis.matchScore}/100\nSummary: ${analysis.summary}\nStrengths: ${analysis.strengths?.join("; ")}\nGaps: ${analysis.gaps?.join("; ")}\nDevelopment plan: ${analysis.developmentPlan?.map((d) => `${d.skill} (${d.priority}): ${d.gap}`).join("; ") ?? "none"}`
        : "AI ANALYSIS: Not yet run",
    ].join("\n");

    const historyText = (history ?? [])
      .slice(-8)
      .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
      .join("\n\n");

    const userPrompt = [
      `[CONTEXT]\n${contextBlock}`,
      historyText ? `\n[CONVERSATION HISTORY]\n${historyText}` : "",
      `\nUser: ${message}`,
    ].join("\n");

    const reply = await callOpenAIChat(CHAT_SYSTEM_PROMPT, userPrompt);

    return NextResponse.json({ reply });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
