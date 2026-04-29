export interface ResumeExperience {
  company: string;
  role: string;
  startDate: string;
  endDate: string;
  bullets: string[];
}

export interface ResumeData {
  name: string;
  title: string;
  summary: string;
  email?: string;
  phone?: string;
  location?: string;
  linkedin?: string;
  experience: ResumeExperience[];
  skills: string[];
  education: Array<{
    institution: string;
    degree: string;
    year: string;
  }>;
}

export interface Job {
  id: string;
  title: string;
  company: string;
  description: string;
  location: string | null;
  salary: string | null;
  source: string;
  url: string;
  createdAt: string;
  matchScore?: number;
  matchReasons?: string[];
}

export interface MatchResult {
  match_score: number;
  reasons: string[];
}

export type ReviewRating = "good" | "ok" | "weak";

export interface SectionReview {
  rating: ReviewRating;
  feedback: string;
  suggestion?: string;
}

export interface ExperienceReview extends SectionReview {
  index: number;
  company: string;
}

export interface ResumeReview {
  overall: { score: number; summary: string };
  sections: {
    summary: SectionReview;
    experience: ExperienceReview[];
    skills: SectionReview;
    education: SectionReview;
  };
}

export interface ReviewHighlights {
  summary?: ReviewRating;
  experience?: ReviewRating[];
  skills?: ReviewRating;
  education?: ReviewRating;
}

export interface JobAnalysis {
  matchScore: number;          // 0–100
  summary: string;             // 2-3 sentence overall assessment
  strengths: string[];         // what aligns well (3 bullets)
  gaps: string[];              // missing skills/experience (3 bullets)
  developmentPlan: Array<{     // actionable skill-building roadmap
    skill: string;             // name of the skill/area
    priority: "critical" | "high" | "nice-to-have";
    gap: string;               // one sentence: what's missing and why it matters
    howToDevelop: string[];    // 3-4 concrete steps (courses, projects, certs)
    resumeEvidence: string[];  // 2-3 specific items to add to resume to prove this skill
  }>;
  suggestedEdits: {
    section: "summary" | "experience" | "skills";
    label: string;             // e.g. "Senior Engineer at Acme" or "Skills"
    before: string;            // current text
    after: string;             // suggested rewrite
    reason: string;            // why this improves the match
  }[];
  tailoredResume: ResumeData;  // full resume with edits applied
}

export interface Application {
  id: string;
  jobId: string;
  status: "SAVED" | "APPLIED" | "INTERVIEW" | "OFFER" | "REJECTED";
  notes?: string;
  createdAt: string;
  updatedAt: string;
  job: Job;
}

export type SwipeAction = "INTERESTED" | "NOT_INTERESTED" | "HIGH_PRIORITY";
