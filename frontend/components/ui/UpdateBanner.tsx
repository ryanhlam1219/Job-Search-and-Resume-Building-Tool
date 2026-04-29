"use client";

import { useEffect, useState } from "react";
import { ArrowUpCircle, X } from "lucide-react";

interface UpdateStatus {
  upToDate: boolean;
  localCommit: string | null;
  remoteCommit: string | null;
}

export function UpdateBanner() {
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    fetch("/api/update-check")
      .then((r) => r.json())
      .then((data: UpdateStatus) => setStatus(data))
      .catch(() => {});
  }, []);

  if (!status || status.upToDate || dismissed) return null;

  return (
    <div className="fixed top-20 left-4 z-40 flex items-start gap-3 px-4 py-3 rounded-xl bg-violet-950 border border-violet-500/30 shadow-xl shadow-violet-900/30 max-w-xs">
      <ArrowUpCircle size={16} className="text-violet-400 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-violet-300">Update available</p>
        <p className="text-xs text-violet-400/70 mt-0.5">
          {status.localCommit} → {status.remoteCommit}
        </p>
        <p className="text-xs text-violet-300/60 mt-1 font-mono">run ./update.sh</p>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="text-violet-400/50 hover:text-violet-300 transition-colors shrink-0"
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  );
}
