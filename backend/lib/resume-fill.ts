import { callOpenAI } from "@/backend/lib/openai";
import type { ResumeData } from "@/backend/lib/types";

// ─── Page-fill estimation ─────────────────────────────────────────────────────
// ResumePreview renders at 816×1056px, 36px top/bottom padding, font-size 11px,
// line-height 1.35 → each text line ≈ 14.85px tall. Content area height = 984px.
// Usable content width (816 – 96px h-padding) = 720px ÷ ~6.5px/char ≈ 110 chars,
// conservative at 85 to account for word-wrap and proportional widths.

const CHARS_PER_LINE = 85;

// Target: ~48 estimated text lines fills the page comfortably.
// (raw capacity ≈ 66 lines, minus section headers/spacing overhead)
const TARGET_LINES = 48;

// Trigger an expansion pass when any role has fewer than this many bullets.
const MIN_BULLETS_BEFORE_EXPAND = 4;

export function estimateResumeLineCount(data: ResumeData): number {
  let lines = 0;

  // Header block: name + title + contact row
  lines += 3;

  if (data.summary) {
    lines += 2; // section heading + rule
    lines += Math.ceil(data.summary.length / CHARS_PER_LINE);
  }

  if (data.experience?.length) {
    lines += 2; // section heading + rule
    for (const exp of data.experience) {
      lines += 2; // "Role   Date" row + "Company" row
      for (const bullet of exp.bullets ?? []) {
        lines += Math.ceil(bullet.length / CHARS_PER_LINE);
      }
      lines += 1; // inter-role spacing
    }
  }

  if (data.skills?.length) {
    lines += 2; // section heading + rule
    lines += Math.ceil(data.skills.join(" • ").length / CHARS_PER_LINE);
  }

  if (data.education?.length) {
    lines += 2; // section heading + rule
    lines += data.education.length;
  }

  return lines;
}

// ─── Expansion prompt ─────────────────────────────────────────────────────────

const EXPAND_SYSTEM_PROMPT = `You are an expert resume writer. Your sole task is to expand a resume so it completely fills a US letter page.

TASK: For every role with fewer than 4 bullet points, add bullets until that role has exactly 4–5 bullets.

ABSOLUTE RULES:
- NEVER change company names, job titles, start/end dates, or education entries
- NEVER remove or rewrite existing bullet points — only ADD new ones
- New bullets must describe specific, realistic achievements consistent with that role and company
- Lead every new bullet with a strong past-tense action verb (Managed, Built, Reduced, Launched, Led, Designed…)
- 12–18 words per bullet; include a metric or outcome where plausible
- Weave keywords from the provided job description in naturally
- If the summary is fewer than 2 sentences, expand it to 2–3 full sentences
- If the skills list has fewer than 12 entries, add relevant skills the candidate would plausibly have
- Return ONLY valid JSON in the EXACT same structure as the input resume — no extra fields, no omissions`;

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Checks whether the tailored resume has enough content to fill a page.
 * If any role has fewer than MIN_BULLETS_BEFORE_EXPAND bullets, OR the estimated
 * line count is below TARGET_LINES, makes a second focused AI call to expand
 * the sparse sections. Falls back to the original resume if the expansion fails.
 */
export async function expandResumeToFillPage(
  resume: ResumeData,
  jobTitle: string,
  company: string,
  jobDescription: string
): Promise<ResumeData> {
  const thinRoles = (resume.experience ?? []).filter(
    (exp) => (exp.bullets ?? []).length < MIN_BULLETS_BEFORE_EXPAND
  );
  const estimatedLines = estimateResumeLineCount(resume);

  // Already dense enough — skip the extra AI call
  if (thinRoles.length === 0 && estimatedLines >= TARGET_LINES) {
    return resume;
  }

  try {
    const expanded = await callOpenAI<ResumeData>(
      EXPAND_SYSTEM_PROMPT,
      `JOB: ${jobTitle} at ${company}\n\nJOB DESCRIPTION:\n${jobDescription.slice(0, 1500)}\n\nRESUME TO EXPAND:\n${JSON.stringify(resume, null, 2)}`
    );

    // Merge result: preserve immutable fields (company/role/dates/education),
    // accept expanded bullets, summary, and skills from the AI.
    return {
      ...resume,
      summary: expanded.summary?.trim() || resume.summary,
      skills: (expanded.skills?.length ? expanded.skills : resume.skills).slice(0, 16),
      education: resume.education, // never let AI mutate education
      experience: (resume.experience ?? []).map((origExp, i) => {
        const aiExp = expanded.experience?.[i];
        return {
          company: origExp.company,
          role: origExp.role,
          startDate: origExp.startDate,
          endDate: origExp.endDate,
          bullets: (aiExp?.bullets?.length ? aiExp.bullets : origExp.bullets).slice(0, 5),
        };
      }),
    };
  } catch {
    // Expansion failed — return original rather than breaking the download
    return resume;
  }
}
