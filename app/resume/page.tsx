"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { ResumeUpload } from "@/frontend/components/resume/ResumeUpload";
import { ResumeEditor } from "@/frontend/components/resume/ResumeEditor";
import { ResumePreview } from "@/frontend/components/resume/ResumePreview";
import type { ResumeData, ResumeReview, ReviewHighlights } from "@/backend/lib/types";
import { toast } from "@/frontend/components/ui/Toaster";
import {
  Save, Download, CheckCircle, AlertTriangle, Loader2, FileText, Wand2, Info,
  Sparkles, X, ChevronDown, ChevronUp
} from "lucide-react";
import { cn } from "@/backend/lib/utils";

export default function ResumePage() {
  const [resumeData, setResumeData] = useState<ResumeData | null>(null);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [fits, setFits] = useState(true);
  const [adjustments, setAdjustments] = useState<string[]>([]);
  const [view, setView] = useState<"upload" | "edit">("upload");
  const [review, setReview] = useState<ResumeReview | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [tailorBanner, setTailorBanner] = useState<{ jobTitle: string; company: string } | null>(null);

  const highlights: ReviewHighlights | undefined = review ? {
    summary: review.sections.summary.rating,
    experience: review.sections.experience.map((e) => e.rating),
    skills: review.sections.skills.rating,
    education: review.sections.education.rating,
  } : undefined;
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadResume();
  }, []);

  const loadResume = async () => {
    try {
      // Check for a pending tailored resume from the job analysis modal
      const pending = sessionStorage.getItem("pendingTailoredResume");
      if (pending) {
        sessionStorage.removeItem("pendingTailoredResume");
        const { resume, jobTitle, company } = JSON.parse(pending);
        setResumeData(resume);
        setView("edit");
        setTailorBanner({ jobTitle, company });
        // Save it to DB immediately
        await fetch("/api/resume", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(resume),
        });
        return;
      }

      const res = await fetch("/api/resume");
      const data = await res.json();
      if (data?.data) {
        setResumeData(data.data as ResumeData);
        setView("edit");
      }
    } catch {}
  };

  const handleParsed = useCallback((data: ResumeData) => {
    setResumeData(data);
    setView("edit");
    toast("Resume parsed successfully!", "success");
  }, []);

  const handleChange = useCallback((data: ResumeData) => {
    setResumeData(data);
    // Debounced auto-save
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => saveResume(data), 1500);
  }, []);

  const saveResume = async (data: ResumeData) => {
    setSaving(true);
    try {
      const res = await fetch("/api/resume", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Save failed");
    } catch {
      toast("Auto-save failed", "error");
    } finally {
      setSaving(false);
    }
  };

  const exportPDF = async () => {
    if (!resumeData) return;
    setExporting(true);
    try {
      const res = await fetch("/api/export-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeData }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Export failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${resumeData.name?.replace(/\s+/g, "_") || "resume"}_resume.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast("PDF downloaded!", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Export failed", "error");
    } finally {
      setExporting(false);
    }
  };

  const handleFitChange = useCallback((f: boolean, adj: string[]) => {
    setFits(f);
    setAdjustments(adj);
  }, []);

  const handleReview = async () => {
    if (!resumeData) return;
    setReviewing(true);
    try {
      const res = await fetch("/api/resume/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeData }),
      });
      if (!res.ok) throw new Error("Review failed");
      const { review: r } = await res.json();
      setReview(r);
      setShowReview(true);
      toast("Review complete!", "success");
    } catch {
      toast("Review failed — is Ollama running?", "error");
    } finally {
      setReviewing(false);
    }
  };

  if (view === "upload" && !resumeData) {
    return (
      <div className="max-w-xl mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-full px-4 py-1.5 text-blue-400 text-sm mb-4">
            <FileText size={14} />
            Resume Builder
          </div>
          <h1 className="text-4xl font-black text-white mb-3">Upload Your Resume</h1>
          <p className="text-gray-400">
            Upload a PDF and our AI will parse it into a structured, editable format with strict 1-page enforcement.
          </p>
        </div>
        <ResumeUpload onParsed={handleParsed} />
        <div className="mt-6 text-center">
          <button
            onClick={() => {
              setResumeData({
                name: "", title: "", summary: "", email: "", phone: "", location: "", linkedin: "",
                experience: [{ company: "", role: "", startDate: "", endDate: "", bullets: [""] }],
                skills: [],
                education: [{ institution: "", degree: "", year: "" }],
              });
              setView("edit");
            }}
            className="text-gray-500 hover:text-gray-300 text-sm underline"
          >
            Start from scratch instead
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-white/10 bg-gray-950/80 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <h1 className="text-white font-bold">Resume Builder</h1>
          {saving && (
            <span className="flex items-center gap-1.5 text-gray-500 text-xs">
              <Loader2 size={11} className="animate-spin" /> Saving…
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Fit indicator */}
          <div className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium",
            fits
              ? "bg-green-500/10 border-green-500/30 text-green-400"
              : "bg-red-500/10 border-red-500/30 text-red-400"
          )}>
            {fits ? <CheckCircle size={12} /> : <AlertTriangle size={12} />}
            {fits ? "Fits on 1 page" : "Overflow detected"}
          </div>

          <button
            onClick={handleReview}
            disabled={reviewing || !resumeData}
            className={cn(
              "flex items-center gap-2 px-4 py-2 border rounded-xl text-sm font-medium transition-colors disabled:opacity-50",
              showReview
                ? "bg-violet-500/20 border-violet-500/40 text-violet-300"
                : "bg-white/5 hover:bg-white/10 border-white/10 text-white"
            )}
          >
            {reviewing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {reviewing ? "Reviewing…" : "AI Review"}
          </button>
          <button
            onClick={() => saveResume(resumeData!)}
            disabled={saving || !resumeData}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
          >
            <Save size={14} />
            Save
          </button>
          <button
            onClick={exportPDF}
            disabled={exporting || !resumeData}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            {exporting ? "Generating…" : "Export PDF"}
          </button>
        </div>
      </div>

      {/* Tailored draft banner */}
      {tailorBanner && (
        <div className="px-6 py-2.5 bg-violet-500/10 border-b border-violet-500/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={13} className="text-violet-400 flex-shrink-0" />
            <p className="text-violet-300 text-xs">
              <span className="font-semibold">AI-tailored</span> for{" "}
              <span className="font-semibold">{tailorBanner.jobTitle}</span> at{" "}
              <span className="font-semibold">{tailorBanner.company}</span> — review the changes below
            </p>
          </div>
          <button onClick={() => setTailorBanner(null)} className="text-violet-400/60 hover:text-violet-300 ml-3">
            <X size={13} />
          </button>
        </div>
      )}

      {/* Adjustments notice */}
      {adjustments.length > 0 && (
        <div className="px-6 py-2 bg-yellow-500/5 border-b border-yellow-500/20 flex items-center gap-2">
          <Info size={13} className="text-yellow-400 flex-shrink-0" />
          <p className="text-yellow-400 text-xs">
            Auto-adjusted to fit 1 page: {adjustments.join(" · ")}
          </p>
        </div>
      )}

      {/* Split screen */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Editor */}
        <div className="w-[420px] flex-shrink-0 border-r border-white/10 overflow-y-auto p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-white font-semibold">Edit Content</h2>
            <button
              onClick={() => { setView("upload"); setResumeData(null); setReview(null); setShowReview(false); setTailorBanner(null); }}
              className="text-gray-500 hover:text-gray-300 text-xs flex items-center gap-1"
            >
              <Wand2 size={11} /> Re-upload
            </button>
          </div>
          {resumeData && (
            <ResumeEditor data={resumeData} onChange={handleChange} />
          )}
        </div>

        {/* Center: Preview */}
        <div className="flex-1 bg-gray-950 overflow-auto flex flex-col items-center py-4 gap-0">
          <div className="flex items-center gap-3 text-sm">
            <span className="text-gray-500">Live Preview</span>
            <span className="text-gray-700">·</span>
            <span className="text-gray-500">8.5 × 11 in</span>
            {highlights && (
              <>
                <span className="text-gray-700">·</span>
                <span className="flex items-center gap-1 text-xs">
                  <span className="w-2 h-2 rounded-full bg-green-500" /><span className="text-gray-500">strong</span>
                  <span className="w-2 h-2 rounded-full bg-yellow-500 ml-1" /><span className="text-gray-500">ok</span>
                  <span className="w-2 h-2 rounded-full bg-red-500 ml-1" /><span className="text-gray-500">weak</span>
                </span>
              </>
            )}
          </div>

          {/* Page boundary indicator */}
          <div className="relative mt-6">
            <div className="text-xs text-gray-600 text-center mb-2">
              ↑ Page Start
            </div>

            {resumeData && (
              <ResumePreview
                data={resumeData}
                onFitChange={handleFitChange}
                className="shadow-2xl"
                highlights={highlights}
              />
            )}

            {/* Page boundary marker */}
            <div className="absolute left-0 right-0" style={{ top: "1056px" }}>
              <div className="border-t-2 border-dashed border-red-500/40 relative">
                <span className="absolute left-2 -top-3 text-xs text-red-400/60 bg-gray-950 px-1">
                  Page boundary (must not exceed)
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: AI Review Panel */}
        {showReview && review && (
          <div className="w-[320px] flex-shrink-0 border-l border-white/10 bg-gray-950/60 overflow-y-auto flex flex-col">
            {/* Panel header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 sticky top-0 bg-gray-950/90 backdrop-blur-xl z-10">
              <div className="flex items-center gap-2">
                <Sparkles size={14} className="text-violet-400" />
                <span className="text-white text-sm font-semibold">AI Review</span>
                <span className={cn(
                  "text-xs font-bold px-2 py-0.5 rounded-full",
                  review.overall.score >= 7 ? "bg-green-500/15 text-green-400" :
                  review.overall.score >= 4 ? "bg-yellow-500/15 text-yellow-400" :
                  "bg-red-500/15 text-red-400"
                )}>
                  {review.overall.score}/10
                </span>
              </div>
              <button onClick={() => setShowReview(false)} className="text-gray-500 hover:text-gray-300 p-1">
                <X size={14} />
              </button>
            </div>

            <div className="p-4 flex flex-col gap-4">
              {/* Overall summary */}
              <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                <p className="text-gray-300 text-xs leading-relaxed">{review.overall.summary}</p>
              </div>

              {/* Summary section */}
              <ReviewSection
                title="Summary"
                rating={review.sections.summary.rating}
                feedback={review.sections.summary.feedback}
                suggestion={review.sections.summary.suggestion}
              />

              {/* Experience */}
              <div>
                <p className="text-gray-500 text-xs uppercase tracking-widest mb-2">Experience</p>
                <div className="flex flex-col gap-2">
                  {review.sections.experience.map((exp) => (
                    <ReviewSection
                      key={exp.index}
                      title={exp.company || `Role ${exp.index + 1}`}
                      rating={exp.rating}
                      feedback={exp.feedback}
                      suggestion={exp.suggestion}
                    />
                  ))}
                </div>
              </div>

              {/* Skills */}
              <ReviewSection
                title="Skills"
                rating={review.sections.skills.rating}
                feedback={review.sections.skills.feedback}
                suggestion={review.sections.skills.suggestion}
              />

              {/* Education */}
              <ReviewSection
                title="Education"
                rating={review.sections.education.rating}
                feedback={review.sections.education.feedback}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ReviewSection({
  title,
  rating,
  feedback,
  suggestion,
}: {
  title: string;
  rating: "good" | "ok" | "weak";
  feedback: string;
  suggestion?: string;
}) {
  const [open, setOpen] = useState(true);
  const colors = {
    good: { dot: "bg-green-500", badge: "bg-green-500/15 text-green-400", border: "border-green-500/20" },
    ok:   { dot: "bg-yellow-500", badge: "bg-yellow-500/15 text-yellow-400", border: "border-yellow-500/20" },
    weak: { dot: "bg-red-500", badge: "bg-red-500/15 text-red-400", border: "border-red-500/20" },
  }[rating];

  return (
    <div className={cn("rounded-xl border bg-white/3", colors.border)}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left"
      >
        <span className={cn("w-2 h-2 rounded-full flex-shrink-0", colors.dot)} />
        <span className="text-white text-xs font-medium flex-1 truncate">{title}</span>
        <span className={cn("text-xs px-1.5 py-0.5 rounded-full font-medium", colors.badge)}>
          {rating}
        </span>
        {open ? <ChevronUp size={12} className="text-gray-500" /> : <ChevronDown size={12} className="text-gray-500" />}
      </button>
      {open && (
        <div className="px-3 pb-3 flex flex-col gap-1.5">
          <p className="text-gray-400 text-xs leading-relaxed">{feedback}</p>
          {suggestion && (
            <p className="text-xs text-violet-300 bg-violet-500/10 border border-violet-500/20 rounded-lg px-2.5 py-1.5 leading-relaxed">
              → {suggestion}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
