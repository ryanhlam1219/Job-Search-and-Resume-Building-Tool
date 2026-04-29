import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/backend/lib/prisma";
import { callOpenAI } from "@/backend/lib/openai";
import { expandResumeToFillPage } from "@/backend/lib/resume-fill";
import type { JobAnalysis, ResumeData } from "@/backend/lib/types";

const DEMO_USER_ID = process.env.DEMO_USER_ID || "demo-user-1";

const ANALYZE_SYSTEM_PROMPT = `You are an expert career coach and resume writer.
Given a resume and a job description, analyze the fit and produce targeted improvements.
Return ONLY valid JSON matching this exact schema:
{
  "matchScore": number (0-100, honest assessment),
  "summary": string (2-3 sentences: overall fit, biggest strength, biggest gap),
  "strengths": string[] (exactly 3 short bullet strings — what aligns well),
  "gaps": string[] (exactly 3 short bullet strings — skills/experience missing),
  "suggestedEdits": [
    {
      "section": "summary" | "experience" | "skills",
      "label": string (section identifier, e.g. "Professional Summary" or company name),
      "before": string (current text, verbatim from resume),
      "after": string (improved version tailored for this job),
      "reason": string (one sentence: why this edit improves the match)
    }
  ],
  "tailoredResume": { ...full ResumeData object with ALL suggested edits applied... }
}

Rules for suggestedEdits:
- Provide 2-4 edits max, most impactful first
- Never fabricate experience, companies, dates, or degrees

Rules for tailoredResume (CRITICAL — the resume must fill a full US letter page):
- Return ALL roles present in the original resume, never drop any
- Write 4-5 bullets per role — always aim for 5 unless the role genuinely had fewer responsibilities
- Lead every bullet with a strong action verb (Managed, Built, Reduced, Increased, Led, Designed)
- Prioritize achievements over responsibilities — show impact with numbers where the original has data
- Bullets should be 10-18 words each (concise but complete)
- Summary: 2-3 sentences tailored to the target job, no buzzwords
- Skills: include 12-16 skills, most-relevant first, no soft skills
- Generate enough content so the resume fills a full page — more content is better than less`;

// POST /api/jobs/[id]/analyze
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const job = await prisma.job.findUnique({ where: { id } });
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const resume = await prisma.resume.findFirst({
      where: { userId: DEMO_USER_ID },
      orderBy: { updatedAt: "desc" },
    });

    if (!resume) {
      return NextResponse.json(
        { error: "No resume found. Upload your resume first." },
        { status: 404 }
      );
    }

    const resumeData = resume.data as ResumeData;

    const analysis = await callOpenAI<JobAnalysis>(
      ANALYZE_SYSTEM_PROMPT,
      `JOB TITLE: ${job.title}
COMPANY: ${job.company}
LOCATION: ${job.location ?? "Not specified"}

JOB DESCRIPTION:
${job.description.slice(0, 3000)}

CURRENT RESUME:
${JSON.stringify(resumeData, null, 2)}`
    );

    // Enforce structure on tailoredResume — allow more bullets for full-page coverage
    if (analysis.tailoredResume) {
      analysis.tailoredResume.experience = (analysis.tailoredResume.experience || resumeData.experience || [])
        .map((exp) => ({
          ...exp,
          bullets: (exp.bullets || []).slice(0, 5),
        }));
      analysis.tailoredResume.skills = (analysis.tailoredResume.skills || resumeData.skills || []).slice(0, 16);

      // Expand sparse roles so the applied resume fills the page
      analysis.tailoredResume = await expandResumeToFillPage(
        analysis.tailoredResume,
        job.title,
        job.company,
        job.description
      );
    }

    return NextResponse.json({ analysis });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
