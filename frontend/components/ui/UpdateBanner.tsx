"use client";

import { useEffect, useState, useRef } from "react";
import { ArrowUpCircle, X, Loader2 } from "lucide-react";

interface UpdateStatus {
  upToDate: boolean;
  localCommit: string | null;
  remoteCommit: string | null;
}

type Phase = "idle" | "updating" | "restarting";

export function UpdateBanner() {
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch("/api/update-check")
      .then((r) => r.json())
      .then((data: UpdateStatus) => {
        setStatus(data);
        // Restore dismissed state — only valid for the same remote commit
        const key = `update-dismissed-${data.remoteCommit}`;
        if (sessionStorage.getItem(key) === "1") setDismissed(true);
      })
      .catch(() => {});
  }, []);

  // Poll until server is back up, then reload
  function startPolling() {
    pollRef.current = setInterval(async () => {
      try {
        const r = await fetch("/api/update-check", { cache: "no-store" });
        if (r.ok) {
          clearInterval(pollRef.current!);
          window.location.reload();
        }
      } catch {
        // server still restarting — keep polling
      }
    }, 2000);
  }

  async function handleUpdate() {
    setPhase("updating");
    try {
      await fetch("/api/run-update", { method: "POST" });
    } catch {
      // expected — server may go down before responding
    }
    setPhase("restarting");
    // Give update.sh a moment to start before polling
    setTimeout(startPolling, 5000);
  }

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  if (!status || status.upToDate || dismissed) return null;

  return (
    <div className="fixed top-20 left-4 z-40 flex items-start gap-3 px-4 py-3 rounded-xl bg-violet-950 border border-violet-500/30 shadow-xl shadow-violet-900/30 max-w-xs">
      <ArrowUpCircle size={16} className="text-violet-400 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-violet-300">Update available</p>
        <p className="text-xs text-violet-400/70 mt-0.5">
          {status.localCommit} → {status.remoteCommit}
        </p>

        {phase === "idle" && (
          <button
            onClick={handleUpdate}
            className="mt-2 px-3 py-1 text-xs font-semibold rounded-lg bg-violet-600 hover:bg-violet-500 text-white transition-colors"
          >
            Update &amp; Restart
          </button>
        )}

        {phase === "updating" && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-violet-300/80">
            <Loader2 size={11} className="animate-spin" />
            Pulling latest changes…
          </p>
        )}

        {phase === "restarting" && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-violet-300/80">
            <Loader2 size={11} className="animate-spin" />
            Restarting… page will reload
          </p>
        )}
      </div>

      {phase === "idle" && (
        <button
          onClick={() => {
            sessionStorage.setItem(`update-dismissed-${status.remoteCommit}`, "1");
            setDismissed(true);
          }}
          className="text-violet-400/50 hover:text-violet-300 transition-colors shrink-0"
          aria-label="Dismiss"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
