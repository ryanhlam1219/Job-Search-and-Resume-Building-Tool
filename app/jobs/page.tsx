"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, MapPin, ExternalLink, Briefcase, Building2, Loader2,
  ChevronLeft, ChevronRight, BookmarkPlus, Check, DollarSign,
  Calendar, ArrowLeft, Sparkles,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { cn } from "@/backend/lib/utils";
import { toast } from "@/frontend/components/ui/Toaster";
import { useAnalysisPanel } from "@/frontend/components/jobs/AnalysisPanelProvider";
import { AnalysisPanelContent } from "@/frontend/components/jobs/AnalysisPanelContent";

interface Job {
  id: string;
  title: string;
  company: string;
  location: string | null;
  salary: string | null;
  source: string;
  url: string;
  description: string | null;
  postedAt: string | null;
  createdAt: string;
}

const SOURCES = ["", "indeed", "linkedin", "glassdoor"];
const PAGE_SIZE = 20;

const SOURCE_COLORS: Record<string, string> = {
  linkedin: "bg-blue-500/10 border-blue-500/20 text-blue-400",
  indeed: "bg-orange-500/10 border-orange-500/20 text-orange-400",
  glassdoor: "bg-green-500/10 border-green-500/20 text-green-400",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days} days ago`;
  return `${Math.floor(days / 30)} mo ago`;
}



export default function JobsPage() {
  const analysisPanel = useAnalysisPanel();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Separate input state (responsive) from query state (drives fetches)
  const [searchInput, setSearchInput] = useState("");
  const [locationInput, setLocationInput] = useState("");
  const [query, setQuery] = useState({ search: "", location: "", source: "", remote: false, hasSalary: false, page: 1 });

  const [selected, setSelected] = useState<Job | null>(null);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState<string | null>(null);
  const [mobileDetail, setMobileDetail] = useState(false);
  const { job: analysisJob, visible: analysisVisible, open: openGlobalAnalysis, show: showGlobalAnalysis } = analysisPanel("jobs");

  const detailRef = useRef<HTMLDivElement>(null);

  const fetchJobs = useCallback(async (s: string, loc: string, src: string, pg: number, remote: boolean, hasSalary: boolean) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(pg),
        limit: String(PAGE_SIZE),
        ...(s && { search: s }),
        ...(loc && { location: loc }),
        ...(src && { source: src }),
        ...(remote && { remote: "true" }),
        ...(hasSalary && { hasSalary: "true" }),
      });
      const res = await fetch(`/api/jobs?${params}`);
      const data = await res.json();
      const newJobs: Job[] = data.jobs || [];
      setJobs(newJobs);
      setTotal(data.total || 0);
      setSelected((prev) => {
        if (prev && newJobs.find((j) => j.id === prev.id)) return prev;
        return newJobs[0] ?? null;
      });
    } catch {
      toast("Failed to load jobs", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounce text inputs — updates the query object, resets to page 1
  useEffect(() => {
    const t = setTimeout(() => {
      setQuery((q) => ({ ...q, search: searchInput, location: locationInput, page: 1 }));
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput, locationInput]);

  // THE single fetch effect — fires on every query change including initial render
  useEffect(() => {
    fetchJobs(query.search, query.location, query.source, query.page, query.remote, query.hasSalary);
  }, [query, fetchJobs]);

  // Scroll detail panel to top when selection changes
  useEffect(() => {
    detailRef.current?.scrollTo({ top: 0 });
  }, [selected?.id]);

  const handleSave = async (job: Job) => {
    setSaving(job.id);
    try {
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save");
      }
      setSaved((prev) => new Set(prev).add(job.id));
      toast(`Saved "${job.title}"`, "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to save", "error");
    } finally {
      setSaving(null);
    }
  };

  const openAnalysis = (job: Job) => {
    openGlobalAnalysis(job);
  };

  const selectJob = (job: Job) => {
    setSelected(job);
    setMobileDetail(true);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      {/* ── Filter bar ─────────────────────────────── */}
      <div className="flex-shrink-0 border-b border-white/10 bg-gray-950/80 backdrop-blur px-4 py-3">
        <div className="max-w-7xl mx-auto flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-44">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search title or company…"
              className="w-full pl-8 pr-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 text-sm"
            />
          </div>
          <div className="relative flex-1 min-w-36">
            <MapPin size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              value={locationInput}
              onChange={(e) => setLocationInput(e.target.value)}
              placeholder="Filter by location…"
              className="w-full pl-8 pr-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 text-sm"
            />
          </div>
          <div className="flex gap-1 flex-wrap">
            {SOURCES.map((s) => (
              <button
                key={s || "all"}
                onClick={() => setQuery((q) => ({ ...q, source: s, page: 1 }))}
                className={cn(
                  "px-3 py-2 rounded-lg text-xs font-medium border transition-colors capitalize",
                  query.source === s
                    ? "bg-violet-500/20 border-violet-500/40 text-violet-300"
                    : "bg-white/5 border-white/10 text-gray-400 hover:text-white hover:bg-white/10"
                )}
              >
                {s || "All"}
              </button>
            ))}
            <div className="w-px bg-white/10 mx-1 self-stretch" />
            <button
              onClick={() => setQuery((q) => ({ ...q, remote: !q.remote, location: "", page: 1 }))}
              className={cn(
                "px-3 py-2 rounded-lg text-xs font-medium border transition-colors",
                query.remote
                  ? "bg-blue-500/20 border-blue-500/40 text-blue-300"
                  : "bg-white/5 border-white/10 text-gray-400 hover:text-white hover:bg-white/10"
              )}
            >
              🌐 Remote
            </button>
            <button
              onClick={() => setQuery((q) => ({ ...q, hasSalary: !q.hasSalary, page: 1 }))}
              className={cn(
                "px-3 py-2 rounded-lg text-xs font-medium border transition-colors",
                query.hasSalary
                  ? "bg-green-500/20 border-green-500/40 text-green-300"
                  : "bg-white/5 border-white/10 text-gray-400 hover:text-white hover:bg-white/10"
              )}
            >
              💰 Has Salary
            </button>
          </div>
        </div>
      </div>

      {/* ── Split view ─────────────────────────────── */}
      <div className="flex flex-1 min-h-0 max-w-7xl w-full mx-auto overflow-hidden relative">

        {/* Left: job list — slides out when hidden */}
        <AnimatePresence initial={false}>
          <motion.div
            key="job-list"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 420, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className={cn(
              "flex flex-col border-r border-white/10 flex-shrink-0 overflow-hidden",
              mobileDetail && selected ? "hidden md:flex" : "flex"
            )}
          >
              {/* List header */}
              <div className="flex-shrink-0 px-4 py-2.5 border-b border-white/10">
                <p className="text-gray-400 text-xs">
                  {loading ? "Loading…" : `${total.toLocaleString()} job${total !== 1 ? "s" : ""}`}
                </p>
              </div>

              {/* List body */}
              <div className="flex-1 overflow-y-auto">
                {loading ? (
                  <div className="flex justify-center pt-16">
                    <Loader2 className="text-violet-400 animate-spin" size={28} />
                  </div>
                ) : jobs.length === 0 ? (
                  <div className="text-center pt-16 px-6">
                    <Briefcase className="text-gray-600 mx-auto mb-3" size={36} />
                    <p className="text-gray-400 text-sm">No jobs found</p>
                    <p className="text-gray-600 text-xs mt-1">Try different filters or scrape new jobs from the dashboard</p>
                  </div>
                ) : (
                  <>
                    {jobs.map((job) => (
                      <button
                        key={job.id}
                        onClick={() => selectJob(job)}
                        className={cn(
                          "w-full text-left px-4 py-3.5 border-b border-white/5 transition-colors group",
                          selected?.id === job.id
                            ? "bg-violet-500/10 border-l-2 border-l-violet-500"
                            : "hover:bg-white/5 border-l-2 border-l-transparent"
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <Building2 size={15} className="text-gray-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={cn(
                              "text-sm font-semibold leading-snug truncate",
                              selected?.id === job.id ? "text-violet-400" : "text-white group-hover:text-white"
                            )}>
                              {job.title}
                            </p>
                            <p className="text-gray-400 text-xs mt-0.5 truncate">{job.company}</p>
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                              {job.location && (
                                <span className="text-gray-500 text-[11px] flex items-center gap-0.5">
                                  <MapPin size={10} /> {job.location}
                                </span>
                              )}
                              {job.salary && (
                                <span className="text-green-400/70 text-[11px]">{job.salary}</span>
                              )}
                              <span className={cn(
                                "text-[10px] px-1.5 py-0.5 rounded-full border capitalize",
                                SOURCE_COLORS[job.source] || "bg-gray-500/10 border-gray-500/20 text-gray-400"
                              )}>
                                {job.source}
                              </span>
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}

                    {/* Pagination */}
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between px-4 py-3 border-t border-white/10">
                        <button
                          onClick={() => setQuery((q) => ({ ...q, page: Math.max(1, q.page - 1) }))}
                          disabled={query.page === 1}
                          className="flex items-center gap-1 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white rounded-lg text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <ChevronLeft size={12} /> Prev
                        </button>
                        <span className="text-gray-500 text-xs">{query.page} / {totalPages}</span>
                        <button
                          onClick={() => setQuery((q) => ({ ...q, page: Math.min(totalPages, q.page + 1) }))}
                          disabled={query.page === totalPages}
                          className="flex items-center gap-1 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white rounded-lg text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Next <ChevronRight size={12} />
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </motion.div>
        </AnimatePresence>

        {/* Middle: job detail */}
        <div
          ref={detailRef}
          className={cn(
            "overflow-y-auto min-w-0",
            analysisVisible && analysisJob ? "w-0 flex-[2] min-w-0" : "flex-1",
            mobileDetail && selected ? "flex flex-col" : "hidden md:flex md:flex-col"
          )}
        >
          {!selected ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-8">
              <Briefcase className="text-gray-700 mb-4" size={48} />
              <p className="text-gray-400 font-medium">Select a job to view details</p>
              <p className="text-gray-600 text-sm mt-1">Click any listing on the left</p>
            </div>
          ) : (
            <div className="p-6 max-w-3xl">
              {/* Mobile back button */}
              <button
                onClick={() => setMobileDetail(false)}
                className="md:hidden flex items-center gap-1.5 text-gray-400 hover:text-white text-sm mb-5 transition-colors"
              >
                <ArrowLeft size={16} /> Back to listings
              </button>

              {/* Job header */}
              <div className="flex items-start gap-4 mb-6">
                <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
                  <Building2 size={22} className="text-gray-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h1 className="text-white font-bold text-xl leading-snug">{selected.title}</h1>
                  <p className="text-gray-300 text-sm mt-0.5">{selected.company}</p>

                  <div className="flex flex-wrap items-center gap-3 mt-2">
                    {selected.location && (
                      <span className="flex items-center gap-1 text-gray-400 text-sm">
                        <MapPin size={13} /> {selected.location}
                      </span>
                    )}
                    {selected.salary && (
                      <span className="flex items-center gap-1 text-green-400 text-sm">
                        <DollarSign size={13} /> {selected.salary}
                      </span>
                    )}
                    <span className={cn(
                      "text-xs px-2 py-0.5 rounded-full border capitalize",
                      SOURCE_COLORS[selected.source] || "bg-gray-500/10 border-gray-500/20 text-gray-400"
                    )}>
                      {selected.source}
                    </span>
                    <span className="flex items-center gap-1 text-gray-500 text-xs">
                      <Calendar size={12} /> {timeAgo(selected.postedAt ?? selected.createdAt)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap gap-3 mb-7 pb-7 border-b border-white/10">
                <a
                  href={selected.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-sm font-medium transition-colors"
                >
                  <ExternalLink size={14} /> Apply Now
                </a>
                <button
                  onClick={() => handleSave(selected)}
                  disabled={saved.has(selected.id) || saving === selected.id}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-colors",
                    saved.has(selected.id)
                      ? "bg-green-500/10 border-green-500/20 text-green-400 cursor-default"
                      : "bg-white/5 border-white/10 text-gray-300 hover:bg-violet-500/10 hover:border-violet-500/20 hover:text-violet-300 disabled:opacity-50"
                  )}
                >
                  {saving === selected.id
                    ? <Loader2 size={14} className="animate-spin" />
                    : saved.has(selected.id)
                    ? <Check size={14} />
                    : <BookmarkPlus size={14} />}
                  {saved.has(selected.id) ? "Saved" : "Save to Tracker"}
                </button>
                <button
                  onClick={() => {
                    if (analysisJob?.id === selected.id && !analysisVisible) {
                      showGlobalAnalysis();
                    } else {
                      openAnalysis(selected);
                    }
                  }}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-colors",
                    analysisJob?.id === selected.id && analysisVisible
                      ? "bg-violet-500/20 border-violet-400/40 text-violet-300"
                      : analysisJob?.id === selected.id && !analysisVisible
                      ? "bg-violet-500/10 border-violet-500/20 text-violet-400"
                      : "bg-white/5 border-white/10 text-gray-300 hover:bg-violet-500/10 hover:border-violet-500/20 hover:text-violet-300"
                  )}
                >
                  <Sparkles size={14} />
                  {analysisJob?.id === selected.id && analysisVisible
                    ? "Analysis Open"
                    : analysisJob?.id === selected.id && !analysisVisible
                    ? "Show Analysis"
                    : "Analyze with AI"}
                </button>
              </div>

              {/* Description */}
              {selected.description ? (
                <div className="text-sm">
                  <h2 className="text-gray-300 font-semibold text-base mb-4">Job Description</h2>
                  <ReactMarkdown
                    components={{
                      p: ({ children }) => <p className="text-gray-300 leading-relaxed mb-3">{children}</p>,
                      ul: ({ children }) => <ul className="list-disc pl-5 mb-3 space-y-1 text-gray-300">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal pl-5 mb-3 space-y-1 text-gray-300">{children}</ol>,
                      li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                      h1: ({ children }) => <h1 className="text-white font-bold text-base mt-5 mb-2">{children}</h1>,
                      h2: ({ children }) => <h2 className="text-white font-semibold text-sm mt-4 mb-2">{children}</h2>,
                      h3: ({ children }) => <h3 className="text-gray-200 font-semibold text-sm mt-3 mb-1">{children}</h3>,
                      strong: ({ children }) => <strong className="text-white font-semibold">{children}</strong>,
                      em: ({ children }) => <em className="text-gray-300 italic">{children}</em>,
                      a: ({ href, children }) => (
                        <a href={href} target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:text-violet-300 underline">{children}</a>
                      ),
                      hr: () => <hr className="border-white/10 my-4" />,
                      blockquote: ({ children }) => <blockquote className="border-l-2 border-violet-500/40 pl-4 text-gray-400 italic my-3">{children}</blockquote>,
                      code: ({ children }) => <code className="bg-white/5 text-violet-300 rounded px-1 py-0.5 text-xs">{children}</code>,
                    }}
                  >
                    {selected.description}
                  </ReactMarkdown>
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-500 text-sm">No description available</p>
                  <a
                    href={selected.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-violet-400 hover:text-violet-300 text-sm underline mt-2 inline-block"
                  >
                    View full listing →
                  </a>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: AI analysis panel */}
        <AnimatePresence initial={false}>
          {analysisVisible && analysisJob && (
            <motion.div
              key="analysis-panel"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 420, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="flex-shrink-0 overflow-hidden border-l border-white/10 p-4 hidden md:block"
            >
              <AnalysisPanelContent scope="jobs" />
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
