import { NextRequest, NextResponse } from "next/server";
import { callOpenAI } from "@/backend/lib/openai";
import type { ResumeReview } from "@/backend/lib/types";

const REVIEW_SYSTEM_PROMPT = `You are an expert resume reviewer helping job seekers improve their resumes.
Analyze the resume and return ONLY valid JSON matching this exact schema:
{
  "overall": {
    "score": number (1-10, be honest and critical),
    "summary": string (1-2 sentences overall impression)
  },
  "sections": {
    "summary": {
      "rating": "good" | "ok" | "weak",
      "feedback": string (1-2 sentences),
      "suggestion": string (one concrete improvement)
    },
    "experience": [
      {
        "index": number (0-based),
        "company": string,
        "rating": "good" | "ok" | "weak",
        "feedback": string (1-2 sentences about this role's bullets),
        "suggestion": string (one concrete improvement for this role)
      }
    ],
    "skills": {
      "rating": "good" | "ok" | "weak",
      "feedback": string (1-2 sentences),
      "suggestion": string (one concrete improvement)
    },
    "education": {
      "rating": "good" | "ok" | "weak",
      "feedback": string (1 sentence)
    }
  }
}

EVALUATION CRITERIA — apply these to every section:

BULLET POINTS:
- Good: leads with action verb, shows achievement with specific number/outcome
  Example: "Reduced customer churn by 18% by redesigning the onboarding flow"
- Ok: describes a real responsibility but lacks quantification or impact
- Weak: vague duty with no specifics, or just lists a skill without context
  Example: "Responsible for customer accounts" → weak
- Penalize buzzword filler: "critical thinker", "team player", "results-driven", "strong communicator"
- Penalize spray-and-pray generic bullets that could appear on anyone's resume

SUMMARY:
- Good: tailored to a target role, concrete, 2–3 sentences max
- Weak: generic, fluffy, or missing entirely

SKILLS:
- Good: specific hard skills relevant to the target role, 10–16 items
- Weak: soft skills ("communication"), obvious skills ("Microsoft Word"), or too few items

FORMAT CONCERNS (call out if present):
- Resume appears to be longer than one page based on content volume
- High school info included when a degree is present
- Photo or personal info beyond name/email/phone/location/LinkedIn

Be direct and constructive. Do NOT fabricate info not in the resume. Score honestly — a 7 means genuinely strong.`;

// POST /api/resume/review
export async function POST(req: NextRequest) {
  try {
    const { resumeData } = await req.json();

    if (!resumeData) {
      return NextResponse.json({ error: "resumeData required" }, { status: 400 });
    }

    const review = await callOpenAI<ResumeReview>(
      REVIEW_SYSTEM_PROMPT,
      `Review this resume and give honest, actionable feedback:\n\n${JSON.stringify(resumeData, null, 2)}`
    );

    return NextResponse.json({ review });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
