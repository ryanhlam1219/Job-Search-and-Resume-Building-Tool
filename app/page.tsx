"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, FileText, Kanban, TrendingUp, Briefcase, ArrowRight, RefreshCw } from "lucide-react";
import { cn } from "@/backend/lib/utils";
import { toast } from "@/frontend/components/ui/Toaster";

interface Stats {
  totalJobs: number;
  swipedJobs: number;
  applications: number;
  interviews: number;
}

export default function HomePage() {
  const [stats, setStats] = useState<Stats>({ totalJobs: 0, swipedJobs: 0, applications: 0, interviews: 0 });
  const [activeScrapes, setActiveScrapes] = useState(0);
  const [searchTerm, setSearchTerm] = useState(() =>
    typeof window !== "undefined" ? (localStorage.getItem("scrape_search") ?? "software engineer") : "software engineer"
  );
  const [location, setLocation] = useState(() =>
    typeof window !== "undefined" ? (localStorage.getItem("scrape_location") ?? "United States") : "United States"
  );
  const [hasResume, setHasResume] = useState(false);

  useEffect(() => {
    fetchStats();
    checkResume();
  }, []);

  const fetchStats = async () => {
    try {
      const [jobsRes, swipesRes, appsRes] = await Promise.all([
        fetch("/api/jobs?limit=1"),
        fetch("/api/swipes"),
        fetch("/api/applications"),
      ]);
      const jobs = await jobsRes.json();
      const swipes = await swipesRes.json();
      const apps = await appsRes.json();
      setStats({
        totalJobs: jobs.total || 0,
        swipedJobs: Array.isArray(swipes) ? swipes.length : 0,
        applications: Array.isArray(apps) ? apps.length : 0,
        interviews: Array.isArray(apps) ? apps.filter((a: { status: string }) => a.status === "INTERVIEW").length : 0,
      });
    } catch {}
  };

  const checkResume = async () => {
    try {
      const res = await fetch("/api/resume");
      const data = await res.json();
      setHasResume(!!data);
    } catch { setHasResume(false); }
  };

  const triggerScrape = async () => {
    const term = searchTerm.trim() || "software engineer";
    const loc = location.trim() || "United States";
    localStorage.setItem("scrape_search", term);
    localStorage.setItem("scrape_location", loc);
    setActiveScrapes((n) => n + 1);
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ search_term: term, location: loc, results_wanted: 50 }),
      });
      const data = await res.json();
      if (res.ok) { toast(`Scraped ${data.total} new jobs for "${term}"!`, "success"); fetchStats(); }
      else toast(data.error || "Scraping failed", "error");
    } catch { toast("Scraper service unavailable", "error"); }
    finally { setActiveScrapes((n) => n - 1); }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-500/20 rounded-full px-4 py-1.5 text-violet-400 text-sm mb-6">
          <Sparkles size={14} />
          AI-Powered Job Discovery
        </div>
        <h1 className="text-5xl font-black text-white mb-4 leading-tight">
          Land your dream job<br />
          <span className="bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">10x faster</span>
        </h1>
        <p className="text-gray-400 text-lg max-w-xl mx-auto">
          Discover jobs, swipe on matches, tailor your resume with AI, and track every application.
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-10">
        {[
          { label: "Jobs Available", value: stats.totalJobs, icon: Briefcase, color: "text-blue-400" },
          { label: "Jobs Reviewed", value: stats.swipedJobs, icon: Sparkles, color: "text-violet-400" },
          { label: "Applications", value: stats.applications, icon: FileText, color: "text-yellow-400" },
          { label: "Interviews", value: stats.interviews, icon: TrendingUp, color: "text-green-400" },
        ].map((stat) => (
          <div key={stat.label} className="bg-gray-900 border border-white/10 rounded-2xl p-5">
            <stat.icon className={cn("mb-3", stat.color)} size={20} />
            <p className="text-3xl font-black text-white">{stat.value}</p>
            <p className="text-gray-400 text-sm mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-gray-900 border border-white/10 rounded-2xl p-6 mb-8">
        <h2 className="text-white font-bold text-lg mb-4">Find New Jobs</h2>
        <div className="flex gap-3 flex-wrap">
          <input value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); localStorage.setItem("scrape_search", e.target.value); }} placeholder="Job title" className="flex-1 min-w-48 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 text-sm" />
          <input value={location} onChange={(e) => { setLocation(e.target.value); localStorage.setItem("scrape_location", e.target.value); }} placeholder="Location" className="flex-1 min-w-36 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 text-sm" />
          <button onClick={triggerScrape} className="flex items-center gap-2 px-6 py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-sm font-semibold transition-colors">
            <RefreshCw size={14} className={activeScrapes > 0 ? "animate-spin" : ""} />
            {activeScrapes > 1 ? `Scraping (${activeScrapes})…` : activeScrapes === 1 ? "Scraping…" : "Scrape Jobs"}
          </button>
        </div>
        <p className="text-gray-600 text-xs mt-3">Scrapes LinkedIn and Indeed via the JobSpy microservice (must be running on port 8000)</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { href: "/swipe", icon: Sparkles, title: "Discover Jobs", description: "Swipe through personalized job matches", color: "from-violet-600 to-purple-600", cta: "Start Swiping", disabled: stats.totalJobs === 0 },
          { href: "/resume", icon: FileText, title: hasResume ? "Edit Resume" : "Upload Resume", description: "Upload, parse, and tailor your resume with AI", color: "from-blue-600 to-cyan-600", cta: hasResume ? "Edit Resume" : "Upload PDF", disabled: false },
          { href: "/applications", icon: Kanban, title: "Track Applications", description: "Kanban board for all your job applications", color: "from-green-600 to-emerald-600", cta: "View Board", disabled: false },
        ].map((action) => (
          <Link key={action.href} href={action.disabled ? "#" : action.href}
            className={cn("group block bg-gray-900 border border-white/10 rounded-2xl p-5 transition-all duration-200", action.disabled ? "opacity-50 cursor-not-allowed" : "hover:border-white/20 hover:bg-gray-800/80 hover:-translate-y-0.5")}>
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-4 bg-gradient-to-br", action.color)}>
              <action.icon size={18} className="text-white" />
            </div>
            <h3 className="text-white font-semibold mb-1">{action.title}</h3>
            <p className="text-gray-400 text-sm mb-4 leading-relaxed">{action.description}</p>
            <span className={cn("flex items-center gap-1.5 text-sm font-medium transition-all", action.disabled ? "text-gray-600" : "text-violet-400 group-hover:gap-2.5")}>
              {action.cta} <ArrowRight size={14} />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
