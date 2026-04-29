"use client";

import { useState } from "react";
import type { Application } from "@/backend/lib/types";
import { cn } from "@/backend/lib/utils";
import { Building2, MapPin, Trash2, ChevronDown, Download, Loader2 } from "lucide-react";

const COLUMNS = [
  { key: "SAVED", label: "Saved", color: "border-blue-500/40 bg-blue-500/5" },
  { key: "APPLIED", label: "Applied", color: "border-yellow-500/40 bg-yellow-500/5" },
  { key: "INTERVIEW", label: "Interview", color: "border-violet-500/40 bg-violet-500/5" },
  { key: "OFFER", label: "Offer 🎉", color: "border-green-500/40 bg-green-500/5" },
  { key: "REJECTED", label: "Rejected", color: "border-red-500/40 bg-red-500/5" },
] as const;

type Status = (typeof COLUMNS)[number]["key"];

interface ApplicationBoardProps {
  applications: Application[];
  onStatusChange: (id: string, status: Status) => void;
  onDelete: (id: string) => void;
  onDownload: (app: Application) => void;
  downloading: string | null;
}

export function ApplicationBoard({ applications, onStatusChange, onDelete, onDownload, downloading }: ApplicationBoardProps) {
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<Status | null>(null);

  const byStatus = (status: Status) =>
    applications.filter((a) => a.status === status);

  const handleDrop = (status: Status) => {
    if (dragging) {
      onStatusChange(dragging, status);
      setDragging(null);
      setDragOver(null);
    }
  };

  return (
    <div className="flex gap-3 h-full overflow-x-auto pb-4">
      {COLUMNS.map((col) => (
        <div
          key={col.key}
          className={cn(
            "flex-shrink-0 w-64 rounded-2xl border p-3 transition-colors flex flex-col",
            "max-h-full",
            col.color,
            dragOver === col.key && "ring-2 ring-violet-500"
          )}
          onDragOver={(e) => { e.preventDefault(); setDragOver(col.key); }}
          onDragLeave={() => setDragOver(null)}
          onDrop={() => handleDrop(col.key)}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-semibold text-sm">{col.label}</h3>
            <span className="text-gray-400 text-xs bg-white/10 px-2 py-0.5 rounded-full">
              {byStatus(col.key).length}
            </span>
          </div>

          <div className="space-y-2 overflow-y-auto flex-1 pr-0.5">
            {byStatus(col.key).map((app) => (
              <AppCard
                key={app.id}
                app={app}
                onDragStart={() => setDragging(app.id)}
                onDragEnd={() => setDragging(null)}
                onDelete={() => onDelete(app.id)}
                onStatusChange={(s) => onStatusChange(app.id, s)}
                onDownload={() => onDownload(app)}
                downloading={downloading === app.id}
              />
            ))}
          </div>

          {byStatus(col.key).length === 0 && (
            <div className="text-center py-6 text-gray-600 text-xs">
              Drop here
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function AppCard({
  app,
  onDragStart,
  onDragEnd,
  onDelete,
  onStatusChange,
  onDownload,
  downloading,
}: {
  app: Application;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDelete: () => void;
  onStatusChange: (s: Status) => void;
  onDownload: () => void;
  downloading: boolean;
}) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={() => {
        if (app.job.url) window.open(app.job.url, "_blank", "noopener,noreferrer");
      }}
      title="Click to open job posting"
      className="relative bg-gray-900/80 border border-white/10 rounded-xl p-3 cursor-pointer active:cursor-grabbing group"
    >
      {/* Delete — top-right corner */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        title="Remove"
        className="absolute top-2 right-2 w-6 h-6 rounded-md flex items-center justify-center text-red-500 hover:text-red-400 hover:bg-red-500/15 transition-colors"
      >
        <Trash2 size={12} />
      </button>

      <p className="text-white font-medium text-xs leading-tight line-clamp-2 pr-7">{app.job.title}</p>
      <div className="flex items-center gap-1 mt-1.5">
        <Building2 size={10} className="text-gray-500 flex-shrink-0" />
        <p className="text-gray-400 text-xs truncate">{app.job.company}</p>
      </div>
      {app.job.location && (
        <div className="flex items-center gap-1 mt-0.5">
          <MapPin size={10} className="text-gray-500 flex-shrink-0" />
          <p className="text-gray-500 text-[11px] truncate">{app.job.location}</p>
        </div>
      )}
      {app.notes && (
        <p className="text-[11px] text-yellow-400/80 mt-1 truncate">{app.notes}</p>
      )}

      <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-white/5 gap-1">
        <span className={cn(
          "text-xs px-2 py-0.5 rounded-full flex-shrink-0",
          app.job.source === "linkedin" ? "bg-blue-500/10 text-blue-400" :
          app.job.source === "indeed" ? "bg-orange-500/10 text-orange-400" :
          "bg-gray-500/10 text-gray-400"
        )}>
          {app.job.source}
        </span>

        <div className="flex items-center gap-1">
          {/* Download tailored resume */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDownload(); }}
            disabled={downloading}
            title="Download AI-tailored resume for this job"
            className="flex items-center gap-1 text-gray-500 hover:text-violet-400 text-[11px] font-medium px-2 py-1 rounded-md bg-white/5 hover:bg-violet-500/10 transition-colors disabled:opacity-50"
          >
            {downloading
              ? <Loader2 size={10} className="animate-spin" />
              : <Download size={10} />}
            {downloading ? "Working…" : "Resume"}
          </button>

          {/* Move to dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setShowMenu((v) => !v); }}
              className="flex items-center gap-0.5 text-gray-500 hover:text-white text-[11px] font-medium px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 transition-colors"
            >
              Move <ChevronDown size={10} />
            </button>
            {showMenu && (
              <div className="absolute right-0 bottom-8 z-50 bg-gray-800 border border-white/10 rounded-xl shadow-xl w-36 py-1 text-xs">
                {COLUMNS.filter((c) => c.key !== app.status).map((col) => (
                  <button
                    key={col.key}
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onStatusChange(col.key); setShowMenu(false); }}
                    className="w-full text-left px-3 py-2 text-gray-300 hover:text-white hover:bg-white/5"
                  >
                    {col.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
