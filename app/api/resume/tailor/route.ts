import { NextRequest, NextResponse } from "next/server";
import { callOpenAI } from "@/backend/lib/openai";
import { expandResumeToFillPage } from "@/backend/lib/resume-fill";
import type { ResumeData } from "@/backend/lib/types";

const TAILOR_SYSTEM_PROMPT = `You are an expert resume writer. Tailor the given resume for a specific job description.
Return ONLY valid JSON in the EXACT same structure as the input resume.

CORE RULES:
- Do NOT fabricate experience, companies, dates, or education — only rewrite what's there
- Do NOT change company names, job titles, dates, or education
- Only modify: summary, bullet points, skills ordering
- Return ALL roles present in the original resume

BULLET POINT RULES (most important):
- Write 4–5 bullets per role — always aim for 5 unless the role genuinely had fewer responsibilities
- Lead every bullet with a strong action verb (Managed, Built, Reduced, Increased, Led, Designed, etc.)
- Prioritize ACHIEVEMENTS over responsibilities. Show impact, not just duties.
  GOOD: "Reduced onboarding time by 30% by redesigning training materials"
  BAD: "Responsible for onboarding new employees"
- Back up bullets with specific numbers, percentages, or outcomes wherever the original resume contains data
  GOOD: "Managed a portfolio of 40+ client accounts, maintaining 95% retention rate"
  BAD: "Managed client accounts"
- Remove generic buzzwords: "critical thinker", "team player", "strong communicator" add no value
- Make bullets substantial — 18–28 words each, describing the HOW and WHY, not just the WHAT
- Include context (team size, scale, tools used, outcome) so bullets wrap to 2 lines in a letter-page layout
- Weave in keywords from the job description naturally — do not keyword-stuff
- If the original bullet is vague, rewrite it to be as specific and impactful as possible given the context

SUMMARY RULES:
- 2–3 sentences maximum
- Tailor directly to the target job title and company
- If the candidate is changing careers, acknowledge it and bridge their transferable experience
  Example: "Sales professional with 5+ years experience transitioning into Operations. Proven track record optimizing processes and driving revenue growth."
- No buzzwords. No filler phrases like "results-driven" or "passionate professional"

SKILLS RULES:
- Include 12–16 skills
- Prioritize skills mentioned in the job description that the candidate actually has
- Order most-relevant skills first
- No soft skills ("communication", "teamwork") — hard skills only

FULL PAGE GOAL:
- Generate enough content (bullets, summary) so the resume fills a full US letter page
- The renderer will auto-shrink if needed, so it is better to have more content than less
- Aim for 4–5 bullets per role, 2–3 sentences in summary, 12+ skills`;

// POST /api/resume/tailor
export async function POST(req: NextRequest) {
  try {
    const { resumeData, jobDescription, jobTitle, company } = await req.json();

    if (!resumeData || !jobDescription) {
      return NextResponse.json(
        { error: "resumeData and jobDescription required" },
        { status: 400 }
      );
    }

    const tailored = await callOpenAI<ResumeData>(
      TAILOR_SYSTEM_PROMPT,
      `JOB: ${jobTitle} at ${company}\n\nJOB DESCRIPTION:\n${jobDescription.slice(0, 3000)}\n\nRESUME TO TAILOR:\n${JSON.stringify(resumeData, null, 2)}`
    );

    // Enforce structure — keep all roles, allow up to 5 bullets
    tailored.experience = (tailored.experience || resumeData.experience || [])
      .map((exp: ResumeData["experience"][0]) => ({
        ...exp,
        bullets: (exp.bullets || []).slice(0, 5),
      }));
    tailored.skills = (tailored.skills || resumeData.skills || []).slice(0, 16);

    // Expand sparse roles / thin content so the resume fills the page
    const filled = await expandResumeToFillPage(
      tailored,
      jobTitle,
      company,
      jobDescription
    );

    return NextResponse.json({ tailored: filled });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
