"use client";

import { useEffect, useState, useCallback } from "react";
import { ApplicationBoard } from "@/frontend/components/jobs/ApplicationBoard";
import type { Application } from "@/backend/lib/types";
import { toast } from "@/frontend/components/ui/Toaster";
import { Kanban, Loader2, FileText, Wand2, Download } from "lucide-react";
import Link from "next/link";

type Status = "SAVED" | "APPLIED" | "INTERVIEW" | "OFFER" | "REJECTED";

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [tailoring, setTailoring] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  const fetchApplications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/applications");
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setApplications(data);
    } catch {
      toast("Failed to load applications", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  const handleStatusChange = useCallback(async (id: string, status: Status) => {
    // Optimistic update
    setApplications((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status } : a))
    );
    try {
      const res = await fetch(`/api/applications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        throw new Error("Update failed");
      }
    } catch {
      toast("Failed to update status", "error");
      fetchApplications(); // Revert
    }
  }, [fetchApplications]);

  const handleDelete = useCallback(async (id: string) => {
    setApplications((prev) => prev.filter((a) => a.id !== id));
    try {
      await fetch(`/api/applications/${id}`, { method: "DELETE" });
    } catch {
      toast("Failed to delete", "error");
      fetchApplications();
    }
  }, [fetchApplications]);

  const handleDownloadTailored = useCallback(async (app: Application) => {
    setDownloading(app.id);
    try {
      const resumeRes = await fetch("/api/resume");
      const resumeRecord = await resumeRes.json();
      if (!resumeRecord?.data) {
        toast("Upload a resume first on the Resume page", "error");
        return;
      }

      toast("Tailoring resume with AI…", "info");
      const tailorRes = await fetch("/api/resume/tailor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resumeData: resumeRecord.data,
          jobDescription: app.job.description,
          jobTitle: app.job.title,
          company: app.job.company,
        }),
      });
      if (!tailorRes.ok) throw new Error("Tailoring failed");
      const { tailored } = await tailorRes.json();

      toast("Generating PDF…", "info");
      const pdfRes = await fetch("/api/export-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeData: tailored }),
      });
      if (!pdfRes.ok) throw new Error("PDF export failed");

      const blob = await pdfRes.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `resume_${app.job.company}_${app.job.title}`
        .replace(/[^a-z0-9]+/gi, "_")
        .toLowerCase() + ".pdf";
      a.click();
      URL.revokeObjectURL(url);

      toast(`Resume downloaded for ${app.job.title}!`, "success");
    } catch (e) {
      toast(`Failed: ${e instanceof Error ? e.message : "unknown error"}`, "error");
    } finally {
      setDownloading(null);
    }
  }, []);

  const handleTailor = useCallback(async (app: Application) => {
    setTailoring(app.id);
    try {
      const resumeRes = await fetch("/api/resume");
      const resumeRecord = await resumeRes.json();
      if (!resumeRecord?.data) {
        toast("Upload a resume first", "error");
        return;
      }

      const res = await fetch("/api/resume/tailor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resumeData: resumeRecord.data,
          jobDescription: app.job.description,
          jobTitle: app.job.title,
          company: app.job.company,
        }),
      });

      if (!res.ok) throw new Error("Tailoring failed");
      const { tailored } = await res.json();

      // Save tailored resume
      await fetch("/api/resume", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tailored),
      });

      toast("Resume tailored for " + app.job.title + "!", "success");
    } catch {
      toast("Failed to tailor resume", "error");
    } finally {
      setTailoring(null);
    }
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-64px)] gap-3">
        <Loader2 className="text-violet-400 animate-spin" size={32} />
        <p className="text-gray-400">Loading applications…</p>
      </div>
    );
  }

  if (applications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-64px)] gap-4 text-center px-4">
        <div className="w-20 h-20 rounded-2xl bg-violet-500/10 border border-violet-500/30 flex items-center justify-center">
          <Kanban className="text-violet-400" size={36} />
        </div>
        <h2 className="text-white font-bold text-2xl">No Applications Yet</h2>
        <p className="text-gray-400 max-w-md">
          Start swiping on jobs to save them here, then track your progress from saved → applied → interview → offer.
        </p>
        <Link
          href="/swipe"
          className="px-6 py-3 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-semibold transition-colors"
        >
          Start Discovering Jobs
        </Link>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col px-6 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-white font-black text-2xl">Application Tracker</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            {applications.length} application{applications.length !== 1 ? "s" : ""} · Drag cards to update status
          </p>
        </div>
        <Link
          href="/swipe"
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-sm font-semibold transition-colors"
        >
          + Discover More Jobs
        </Link>
      </div>

      {/* Board */}
      <div className="flex-1 min-h-0">
        <ApplicationBoard
          applications={applications}
          onStatusChange={handleStatusChange}
          onDelete={handleDelete}
          onDownload={handleDownloadTailored}
          downloading={downloading}
        />
      </div>
    </div>
  );
}
