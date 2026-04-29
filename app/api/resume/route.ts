import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/backend/lib/prisma";
import { callOpenAI } from "@/backend/lib/openai";
import type { ResumeData } from "@/backend/lib/types";

const DEMO_USER_ID = process.env.DEMO_USER_ID || "demo-user-1";

const PARSE_SYSTEM_PROMPT = `You are a resume parser. Extract content VERBATIM from the resume — do NOT rephrase, summarize, or shorten anything.
Return ONLY valid JSON matching this exact schema:
{
  "name": string,
  "title": string,
  "email": string,
  "phone": string,
  "location": string,
  "linkedin": string,
  "summary": string,
  "experience": [
    {
      "company": string,
      "role": string,
      "startDate": string,
      "endDate": string,
      "bullets": string[] (3–5 items per role, copy VERBATIM from resume)
    }
  ],
  "skills": string[],
  "education": [
    {
      "institution": string,
      "degree": string,
      "year": string
    }
  ]
}
Rules:
- Copy ALL bullet points, summary, and skills EXACTLY as written — no rephrasing, no truncation
- Extract 3–5 bullet points per role (include all bullets present; only skip if a role truly has fewer than 3)
- Extract every experience role, every bullet, every skill present in the resume
- Normalize dates to "Month YYYY" format only
- No hallucination: if data is missing, use empty string or empty array`;

// GET /api/resume
export async function GET() {
  try {
    await prisma.user.upsert({
      where: { id: DEMO_USER_ID },
      create: { id: DEMO_USER_ID, email: "demo@jobassistant.ai", name: "Demo User" },
      update: {},
    });

    const resume = await prisma.resume.findFirst({
      where: { userId: DEMO_USER_ID },
      orderBy: { updatedAt: "desc" },
    });

    if (!resume) return NextResponse.json(null);
    return NextResponse.json(resume);
  } catch {
    return NextResponse.json({ error: "Failed to fetch resume" }, { status: 500 });
  }
}

// POST /api/resume — parse raw text into structured resume
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const rawText = formData.get("rawText") as string | null;
    const resumeJson = formData.get("resumeData") as string | null;

    await prisma.user.upsert({
      where: { id: DEMO_USER_ID },
      create: { id: DEMO_USER_ID, email: "demo@jobassistant.ai", name: "Demo User" },
      update: {},
    });

    let data: ResumeData;

    if (resumeJson) {
      // Direct JSON save
      data = JSON.parse(resumeJson) as ResumeData;
    } else if (rawText) {
      // AI parsing
      data = await callOpenAI<ResumeData>(
        PARSE_SYSTEM_PROMPT,
        `Parse this resume:\n\n${rawText.slice(0, 16000)}`
      );
    } else {
      return NextResponse.json({ error: "rawText or resumeData required" }, { status: 400 });
    }

    const existingResume = await prisma.resume.findFirst({
      where: { userId: DEMO_USER_ID },
    });

    const resume = existingResume
      ? await prisma.resume.update({
          where: { id: existingResume.id },
          data: {
            name: data.name,
            title: data.title,
            rawText: rawText || undefined,
            data: data as object,
          },
        })
      : await prisma.resume.create({
          data: {
            userId: DEMO_USER_ID,
            name: data.name,
            title: data.title,
            rawText: rawText || undefined,
            data: data as object,
          },
        });

    return NextResponse.json(resume);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// PATCH /api/resume — update resume data
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const data = body as ResumeData;

    // Enforce limits
    data.experience = (data.experience || []).slice(0, 4).map((exp) => ({
      ...exp,
      bullets: (exp.bullets || []).slice(0, 3),
    }));
    data.skills = (data.skills || []).slice(0, 12);

    const existingResume = await prisma.resume.findFirst({
      where: { userId: DEMO_USER_ID },
    });

    if (!existingResume) {
      return NextResponse.json({ error: "No resume found" }, { status: 404 });
    }

    const resume = await prisma.resume.update({
      where: { id: existingResume.id },
      data: {
        name: data.name,
        title: data.title,
        data: data as object,
      },
    });

    return NextResponse.json(resume);
  } catch {
    return NextResponse.json({ error: "Failed to update resume" }, { status: 500 });
  }
}
