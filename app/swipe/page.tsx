"use client";

import { useEffect, useState, useCallback } from "react";
import { SwipeInterface } from "@/frontend/components/jobs/SwipeInterface";
import type { Job, SwipeAction } from "@/backend/lib/types";
import { toast } from "@/frontend/components/ui/Toaster";
import { logger } from "@/frontend/lib/logger";
import { Loader2, Sparkles, Search, MapPin, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { cn } from "@/backend/lib/utils";

const SUGGESTED_ROLES = [
  "Software Engineer",
  "Admin Assistant",
  "Care Coordinator",
  "Project Manager",
  "Data Analyst",
  "Nurse",
  "Marketing Manager",
  "Sales Representative",
];

const SUGGESTED_LOCATIONS = [
  "Remote",
  "United States",
  "New York, NY",
  "Los Angeles, CA",
  "Chicago, IL",
  "Austin, TX",
  "Seattle, WA",
];

export default function SwipePage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [stack, setStack] = useState<Job[]>([]);
  const [history, setHistory] = useState<Job[]>([]); // undo history — last swiped at end
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("Software Engineer");
  const [location, setLocation] = useState("Remote");
  const [filterRemote, setFilterRemote] = useState(false);
  const [filterHasSalary, setFilterHasSalary] = useState(false);
  const [purging, setPurging] = useState(false);

  const fetchJobs = useCallback(async (remote = filterRemote, hasSalary = filterHasSalary) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "20" });
      if (remote) params.set("remote", "true");
      if (hasSalary) params.set("hasSalary", "true");
      const res = await fetch(`/api/jobs/swipeable?${params}`);
      if (!res.ok) throw new Error("Failed to load jobs");
      const data = await res.json();
      logger.info("SwipePage", "Stack loaded from API", { count: data.length, remote, hasSalary });
      setJobs(data);
      setStack(data);
      setHistory([]);
      try {
        sessionStorage.setItem("discover_stack", JSON.stringify(data));
        sessionStorage.removeItem("discover_history");
      } catch { /* ignore */ }
    } catch (err) {
      logger.error("SwipePage", "Failed to load swipeable jobs", err);
      toast("Failed to load jobs", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  // On mount: restore saved stack from session, or fetch fresh
  useEffect(() => {
    try {
      const savedStack = sessionStorage.getItem("discover_stack");
      if (savedStack) {
        const parsed: Job[] = JSON.parse(savedStack);
        if (parsed.length > 0) {
          const savedHistory = sessionStorage.getItem("discover_history");
          setStack(parsed);
          setHistory(savedHistory ? (JSON.parse(savedHistory) as Job[]) : []);
          setLoading(false);
          logger.info("SwipePage", "Restored stack from session", { count: parsed.length });
          return;
        }
      }
    } catch { /* ignore */ }
    fetchJobs(filterRemote, filterHasSalary);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = useCallback(async () => {
    if (!searchTerm.trim()) return;
    setScraping(true);
      toast("Searching for jobs… this may take a minute", "info");
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          search_term: searchTerm.trim(),
          location: location.trim() || "United States",
          results_wanted: 30,
        }),
      });
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      toast(`Found ${data.total ?? 0} new jobs!`, "success");
      setSearchOpen(false);
      await fetchJobs();
    } catch {
      toast("Job search failed — is the scraper running?", "error");
    } finally {
      setScraping(false);
    }
  }, [searchTerm, location, fetchJobs]);

  // Wraps onStackChange to also sync to sessionStorage
  const handleStackChange = useCallback((newStack: Job[]) => {
    setStack(newStack);
    try { sessionStorage.setItem("discover_stack", JSON.stringify(newStack)); } catch { /* ignore */ }
  }, []);

  const handleSwipe = useCallback(async (jobId: string, action: SwipeAction) => {
    // Find the job being swiped and push to history BEFORE the API call
    const swipedJob = stack.find((j) => j.id === jobId);
    if (swipedJob) {
      const newHistory = [...history, swipedJob];
      setHistory(newHistory);
      try { sessionStorage.setItem("discover_history", JSON.stringify(newHistory)); } catch { /* ignore */ }
      logger.info("SwipePage", "Card swiped", { jobId, action, historySize: newHistory.length });
    }
    try {
      const res = await fetch("/api/swipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, action }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || "Server error");
      }
      if (action === "INTERESTED") toast("Saved to applications!", "success");
      if (action === "HIGH_PRIORITY") toast("Saved to applications! ⭐ High priority", "success");
    } catch (e) {
      logger.error("SwipePage", "Swipe API call failed", e);
      toast(`Failed to save: ${e instanceof Error ? e.message : "unknown error"}`, "error");
    }
  }, [stack, history]);

  const handleUndo = useCallback(async () => {
    if (history.length === 0) return;
    const lastJob = history[history.length - 1];
    logger.info("SwipePage", "Undoing swipe", { jobId: lastJob.id, title: lastJob.title });
    try {
      await fetch("/api/swipes", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: lastJob.id }),
      });
      const newHistory = history.slice(0, -1);
      const newStack = [...stack, lastJob];
      setHistory(newHistory);
      setStack(newStack);
      try {
        sessionStorage.setItem("discover_stack", JSON.stringify(newStack));
        sessionStorage.setItem("discover_history", JSON.stringify(newHistory));
      } catch { /* ignore */ }
      logger.info("SwipePage", "Undo successful", { jobId: lastJob.id, stackSize: newStack.length });
    } catch (e) {
      logger.error("SwipePage", "Undo failed", e);
      toast("Failed to undo", "error");
    }
  }, [history, stack]);

  const handlePurgeDiscover = useCallback(async () => {
    if (!confirm("Purge all Discover jobs? This removes jobs, swipes, and applications linked to those jobs.")) {
      return;
    }

    setPurging(true);
    try {
      const res = await fetch("/api/jobs/swipeable", { method: "DELETE" });
      if (!res.ok) throw new Error("Purge failed");
      const data = await res.json();
      setJobs([]);
      setStack([]);
      try {
        sessionStorage.removeItem("discover_stack");
        sessionStorage.removeItem("discover_history");
      } catch { /* ignore */ }
      toast(`Purged ${data.deletedJobs ?? 0} discover jobs`, "success");
    } catch {
      toast("Failed to purge discover jobs", "error");
    } finally {
      setPurging(false);
    }
  }, []);

  if (loading && stack.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-64px)] gap-3">
        <Loader2 className="text-violet-400 animate-spin" size={32} />
        <p className="text-gray-400">Loading jobs…</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-500/20 rounded-full px-4 py-1.5 text-violet-400 text-sm mb-3">
          <Sparkles size={14} />
          Job Discovery
        </div>
        <h1 className="text-3xl font-black text-white mb-2">Find Your Next Role</h1>
        <p className="text-gray-400 text-sm">
          Swipe right to save · Heart for high priority · Left to skip
        </p>
        <div className="mt-4">
          <button
            type="button"
            onClick={handlePurgeDiscover}
            disabled={purging}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20 transition-colors text-xs font-medium disabled:opacity-50"
          >
            {purging ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
            {purging ? "Purging…" : "Purge Discover Jobs"}
          </button>
        </div>
      </div>

      {/* Search panel */}
      <div className="mb-6 bg-gray-900/60 border border-white/10 rounded-2xl overflow-hidden">
        <button
          onClick={() => setSearchOpen((o) => !o)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm text-gray-300 hover:text-white transition-colors"
        >
          <span className="flex items-center gap-2">
            <Search size={14} className="text-violet-400" />
            <span>
              <span className="font-semibold text-white">{searchTerm}</span>
              <span className="text-gray-500 mx-1.5">·</span>
              <span className="text-gray-400">{location}</span>
            </span>
          </span>
          {searchOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {searchOpen && (
          <div className="px-4 pb-4 border-t border-white/10 pt-4 space-y-4">
            {/* Role input */}
            <div>
              <label className="block text-xs text-gray-400 mb-1.5 font-medium">Job title / role</label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="e.g. Care Coordinator"
                className="w-full bg-gray-800 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-violet-500/50"
              />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {SUGGESTED_ROLES.map((r) => (
                  <button
                    key={r}
                    onClick={() => setSearchTerm(r)}
                    className="text-xs px-2.5 py-1 rounded-full bg-gray-800 border border-white/10 text-gray-400 hover:border-violet-500/40 hover:text-violet-300 transition-colors"
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* Location input */}
            <div>
              <label className="block text-xs text-gray-400 mb-1.5 font-medium flex items-center gap-1">
                <MapPin size={11} /> Location
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="e.g. Remote or New York, NY"
                className="w-full bg-gray-800 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-violet-500/50"
              />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {SUGGESTED_LOCATIONS.map((l) => (
                  <button
                    key={l}
                    onClick={() => setLocation(l)}
                    className="text-xs px-2.5 py-1 rounded-full bg-gray-800 border border-white/10 text-gray-400 hover:border-violet-500/40 hover:text-violet-300 transition-colors"
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {/* Filters */}
            <div>
              <label className="block text-xs text-gray-400 mb-1.5 font-medium">Quick filters (apply to current stack)</label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => { setFilterRemote((v) => { fetchJobs(!v, filterHasSalary); return !v; }); }}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                    filterRemote
                      ? "bg-blue-500/20 border-blue-500/40 text-blue-300"
                      : "bg-gray-800 border-white/10 text-gray-400 hover:text-white hover:bg-white/10"
                  )}
                >
                  🌐 Remote only
                </button>
                <button
                  type="button"
                  onClick={() => { setFilterHasSalary((v) => { fetchJobs(filterRemote, !v); return !v; }); }}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                    filterHasSalary
                      ? "bg-green-500/20 border-green-500/40 text-green-300"
                      : "bg-gray-800 border-white/10 text-gray-400 hover:text-white hover:bg-white/10"
                  )}
                >
                  💰 Has salary listed
                </button>
              </div>
            </div>

            <button
              onClick={handleSearch}
              disabled={scraping || !searchTerm.trim()}
              className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-xl py-2.5 transition-colors"
            >
              {scraping ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Searching…
                </>
              ) : (
                <>
                  <Search size={14} />
                  Search Jobs
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex justify-center gap-6 mb-6 text-xs text-gray-500">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-500/40 border border-red-500/60"></span> Skip</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-pink-500/40 border border-pink-500/60"></span> High Priority</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-green-500/40 border border-green-500/60"></span> Interested</span>
      </div>

      <div style={{ minHeight: "660px" }}>
        <SwipeInterface
          stack={stack}
          onSwipe={handleSwipe}
          onStackChange={handleStackChange}
          onEmpty={fetchJobs}
          onUndo={handleUndo}
          canUndo={history.length > 0}
        />
      </div>
    </div>
  );
}
