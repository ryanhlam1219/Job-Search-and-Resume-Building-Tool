"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Job, JobAnalysis } from "@/backend/lib/types";
import { cn } from "@/backend/lib/utils";
import {
  X, Loader2, Sparkles, ChevronDown, ChevronUp,
  TrendingUp, AlertCircle, CheckCircle2, ArrowRight, Wand2
} from "lucide-react";

interface JobAnalysisModalProps {
  job: Job;
  onClose: () => void;
}

export function JobAnalysisModal({ job, onClose }: JobAnalysisModalProps) {
  const router = useRouter();
  const [analysis, setAnalysis] = useState<JobAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedEdit, setExpandedEdit] = useState<number | null>(0);
  const [applied, setApplied] = useState(false);

  const runAnalysis = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/jobs/${job.id}/analyze`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Analysis failed");
      setAnalysis(data.analysis);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  };

  const applyToResume = () => {
    if (!analysis?.tailoredResume) return;
    // Store tailored resume in sessionStorage so the resume page can pick it up
    sessionStorage.setItem(
      "pendingTailoredResume",
      JSON.stringify({
        resume: analysis.tailoredResume,
        jobTitle: job.title,
        company: job.company,
      })
    );
    setApplied(true);
    setTimeout(() => {
      onClose();
      router.push("/resume");
    }, 800);
  };

  const scoreColor =
    !analysis ? "" :
    analysis.matchScore >= 75 ? "text-green-400" :
    analysis.matchScore >= 50 ? "text-yellow-400" : "text-red-400";

  const scoreBg =
    !analysis ? "" :
    analysis.matchScore >= 75 ? "bg-green-500/10 border-green-500/30" :
    analysis.matchScore >= 50 ? "bg-yellow-500/10 border-yellow-500/30" : "bg-red-500/10 border-red-500/30";

  return (
    <div className="h-full flex flex-col bg-gray-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-white/10 flex-shrink-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles size={15} className="text-violet-400 flex-shrink-0" />
              <span className="text-violet-400 text-xs font-semibold uppercase tracking-wider">AI Job Analysis</span>
            </div>
            <h2 className="text-white font-bold text-base leading-tight truncate">{job.title}</h2>
            <p className="text-gray-400 text-sm truncate">{job.company}{job.location ? ` · ${job.location}` : ""}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white p-1 ml-3 flex-shrink-0">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* Initial state */}
          {!analysis && !loading && !error && (
            <div className="flex flex-col items-center text-center py-6 gap-4">
              <div className="w-16 h-16 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                <Sparkles size={28} className="text-violet-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold mb-1">Analyze Resume Fit</h3>
                <p className="text-gray-400 text-sm leading-relaxed max-w-xs">
                  AI will score how well your resume matches this job, identify gaps, and suggest specific edits you can apply in one click.
                </p>
              </div>
              {!loading && (
                <p className="text-gray-600 text-xs">Requires a saved resume · Takes ~15–30s</p>
              )}
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <Loader2 size={32} className="text-violet-400 animate-spin" />
              <p className="text-gray-400 text-sm">Analyzing your resume against this job…</p>
              <p className="text-gray-600 text-xs">This may take 15–30 seconds</p>
            </div>
          )}

          {/* Error */}
          {error && !loading && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-center">
              <p className="text-red-400 text-sm mb-3">{error}</p>
              <button
                onClick={runAnalysis}
                className="text-xs text-red-400 hover:text-red-300 underline"
              >
                Try again
              </button>
            </div>
          )}

          {/* Results */}
          {analysis && !loading && (
            <div className="flex flex-col gap-4">
              {/* Score + summary */}
              <div className={cn("rounded-xl border p-4 flex items-start gap-4", scoreBg)}>
                <div className="text-center flex-shrink-0">
                  <div className={cn("text-4xl font-black", scoreColor)}>{analysis.matchScore}</div>
                  <div className="text-gray-500 text-xs">/ 100</div>
                </div>
                <p className="text-gray-300 text-sm leading-relaxed">{analysis.summary}</p>
              </div>

              {/* Strengths & Gaps */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <CheckCircle2 size={13} className="text-green-400" />
                    <span className="text-green-400 text-xs font-semibold">Strengths</span>
                  </div>
                  <ul className="space-y-1.5">
                    {analysis.strengths.map((s, i) => (
                      <li key={i} className="text-gray-300 text-xs leading-snug flex items-start gap-1">
                        <span className="text-green-500 mt-0.5 flex-shrink-0">✓</span>{s}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <AlertCircle size={13} className="text-red-400" />
                    <span className="text-red-400 text-xs font-semibold">Gaps</span>
                  </div>
                  <ul className="space-y-1.5">
                    {analysis.gaps.map((g, i) => (
                      <li key={i} className="text-gray-300 text-xs leading-snug flex items-start gap-1">
                        <span className="text-red-400 mt-0.5 flex-shrink-0">✗</span>{g}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Suggested edits */}
              {analysis.suggestedEdits?.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp size={13} className="text-violet-400" />
                    <span className="text-violet-400 text-xs font-semibold uppercase tracking-wider">Suggested Edits</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {analysis.suggestedEdits.map((edit, i) => (
                      <div key={i} className="bg-white/3 border border-white/10 rounded-xl overflow-hidden">
                        <div
                          onClick={() => setExpandedEdit(expandedEdit === i ? null : i)}
                          className="flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-white/5"
                        >
                          <span className="text-xs px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300 font-medium capitalize flex-shrink-0">
                            {edit.section}
                          </span>
                          <span className="text-white text-xs font-medium flex-1 truncate">{edit.label}</span>
                          {expandedEdit === i
                            ? <ChevronUp size={12} className="text-gray-500 flex-shrink-0" />
                            : <ChevronDown size={12} className="text-gray-500 flex-shrink-0" />}
                        </div>
                        {expandedEdit === i && (
                          <div className="px-3 pb-3 flex flex-col gap-2 border-t border-white/10 pt-2">
                            <div className="bg-red-500/5 border border-red-500/15 rounded-lg p-2">
                              <p className="text-gray-500 text-xs mb-0.5 uppercase tracking-wide">Before</p>
                              <p className="text-gray-400 text-xs leading-relaxed line-clamp-3">{edit.before}</p>
                            </div>
                            <div className="flex justify-center text-gray-600"><ArrowRight size={12} /></div>
                            <div className="bg-green-500/5 border border-green-500/15 rounded-lg p-2">
                              <p className="text-gray-500 text-xs mb-0.5 uppercase tracking-wide">After</p>
                              <p className="text-gray-300 text-xs leading-relaxed">{edit.after}</p>
                            </div>
                            <p className="text-violet-300/70 text-xs italic">→ {edit.reason}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 flex gap-3 flex-shrink-0">
          {!analysis ? (
            <button
              onClick={runAnalysis}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold text-sm rounded-xl py-2.5 transition-colors"
            >
              {loading
                ? <><Loader2 size={14} className="animate-spin" /> Analyzing…</>
                : <><Sparkles size={14} /> Analyze Match</>}
            </button>
          ) : (
            <>
              <button
                onClick={runAnalysis}
                disabled={loading}
                className="px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 text-sm rounded-xl transition-colors disabled:opacity-50"
              >
                Re-run
              </button>
              <button
                onClick={applyToResume}
                disabled={applied}
                className="flex-1 flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:bg-green-600 text-white font-semibold text-sm rounded-xl py-2.5 transition-colors"
              >
                {applied
                  ? <><CheckCircle2 size={14} /> Applied! Going to Resume…</>
                  : <><Wand2 size={14} /> Apply Edits to Resume</>}
              </button>
            </>
          )}
        </div>
    </div>
  );
}
