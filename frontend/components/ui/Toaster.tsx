"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/backend/lib/utils";

interface Toast {
  id: string;
  message: string;
  type: "success" | "error" | "info";
}

let toastListeners: Array<(toast: Toast) => void> = [];

export function toast(message: string, type: Toast["type"] = "info") {
  const t: Toast = { id: Date.now().toString(), message, type };
  toastListeners.forEach((l) => l(t));
}

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const listener = (t: Toast) => {
      setToasts((prev) => [...prev, t]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((x) => x.id !== t.id));
      }, 4000);
    };
    toastListeners.push(listener);
    return () => {
      toastListeners = toastListeners.filter((l) => l !== listener);
    };
  }, []);

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            "flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border text-sm font-medium max-w-sm",
            t.type === "success" && "bg-green-950 border-green-500/30 text-green-300",
            t.type === "error" && "bg-red-950 border-red-500/30 text-red-300",
            t.type === "info" && "bg-gray-900 border-white/10 text-white"
          )}
        >
          <span className="flex-1">{t.message}</span>
          <button
            onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
            className="text-current opacity-50 hover:opacity-100"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
