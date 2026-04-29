"use client";

import { createContext, useContext, useMemo, useState } from "react";
import type { ResumeData, ResumeReview } from "@/backend/lib/types";
import { toast } from "@/frontend/components/ui/Toaster";

interface ResumeReviewContextValue {
  review: ResumeReview | null;
  reviewing: boolean;
  showReview: boolean;
  runReview: (resumeData: ResumeData) => Promise<void>;
  setShowReview: (v: boolean) => void;
  clearReview: () => void;
}

const ResumeReviewContext = createContext<ResumeReviewContextValue | null>(null);

export function ResumeReviewProvider({ children }: { children: React.ReactNode }) {
  const [review, setReview] = useState<ResumeReview | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [showReview, setShowReview] = useState(false);

  const runReview = async (resumeData: ResumeData) => {
    if (reviewing) return;
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
      toast("AI Review complete!", "success");
    } catch {
      toast("Review failed — is Ollama running?", "error");
    } finally {
      setReviewing(false);
    }
  };

  const clearReview = () => {
    setReview(null);
    setShowReview(false);
  };

  const value = useMemo(
    () => ({ review, reviewing, showReview, runReview, setShowReview, clearReview }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [review, reviewing, showReview]
  );

  return (
    <ResumeReviewContext.Provider value={value}>
      {children}
    </ResumeReviewContext.Provider>
  );
}

export function useResumeReview() {
  const ctx = useContext(ResumeReviewContext);
  if (!ctx) throw new Error("useResumeReview must be used within ResumeReviewProvider");
  return ctx;
}
