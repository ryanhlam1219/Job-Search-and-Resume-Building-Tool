"use client";

import { createContext, useContext, useMemo, useState } from "react";
import type { Job, JobAnalysis } from "@/backend/lib/types";

type AnalysisJob = Omit<Job, "description"> & { description: string | null };
export type AnalysisPanelScope = "jobs" | "discover";

export type ChatMessage = { role: "user" | "assistant"; content: string };

interface AnalysisPanelState {
  job: AnalysisJob | null;
  visible: boolean;
  analysis: JobAnalysis | null;
  loading: boolean;
  error: string | null;
  expandedEdit: number | null;
  applied: boolean;
  chatOpen: boolean;
  chatHistory: ChatMessage[];
  chatLoading: boolean;
}

const initialPanelState: AnalysisPanelState = {
  job: null,
  visible: false,
  analysis: null,
  loading: false,
  error: null,
  expandedEdit: 0,
  applied: false,
  chatOpen: false,
  chatHistory: [],
  chatLoading: false,
};

type AnalysisPanelsState = Record<AnalysisPanelScope, AnalysisPanelState>;

interface AnalysisPanelContextValue {
  getPanel: (scope: AnalysisPanelScope) => AnalysisPanelState;
  open: (scope: AnalysisPanelScope, job: AnalysisJob) => void;
  close: (scope: AnalysisPanelScope) => void;
  hide: (scope: AnalysisPanelScope) => void;
  show: (scope: AnalysisPanelScope) => void;
  runAnalysis: (scope: AnalysisPanelScope) => Promise<void>;
  setExpandedEdit: (scope: AnalysisPanelScope, i: number | null) => void;
  setApplied: (scope: AnalysisPanelScope, v: boolean) => void;
  setChatOpen: (scope: AnalysisPanelScope, v: boolean) => void;
  setChatHistory: (scope: AnalysisPanelScope, history: ChatMessage[]) => void;
  setChatLoading: (scope: AnalysisPanelScope, v: boolean) => void;
}

const AnalysisPanelContext = createContext<AnalysisPanelContextValue | null>(null);

export function AnalysisPanelProvider({ children }: { children: React.ReactNode }) {
  const [panels, setPanels] = useState<AnalysisPanelsState>({
    jobs: initialPanelState,
    discover: initialPanelState,
  });

  const getPanel = (scope: AnalysisPanelScope) => panels[scope];

  const open = (scope: AnalysisPanelScope, nextJob: AnalysisJob) => {
    setPanels((current) => {
      const panel = current[scope];
      const nextPanel = panel.job?.id !== nextJob.id
        ? {
            ...panel,
            job: nextJob,
            visible: true,
            analysis: null,
            error: null,
            expandedEdit: 0,
            applied: false,            chatOpen: false,
            chatHistory: [],
            chatLoading: false,
          }
        : {
            ...panel,
            job: nextJob,
            visible: true,
          };

      return {
        ...current,
        [scope]: nextPanel,
      };
    });
  };

  const close = (scope: AnalysisPanelScope) => {
    setPanels((current) => ({
      ...current,
      [scope]: initialPanelState,
    }));
  };

  const hide = (scope: AnalysisPanelScope) => {
    setPanels((current) => ({
      ...current,
      [scope]: {
        ...current[scope],
        visible: false,
      },
    }));
  };

  const show = (scope: AnalysisPanelScope) => {
    setPanels((current) => {
      const panel = current[scope];
      if (!panel.job) return current;
      return {
        ...current,
        [scope]: {
          ...panel,
          visible: true,
        },
      };
    });
  };

  const runAnalysis = async (scope: AnalysisPanelScope) => {
    const panel = panels[scope];
    if (!panel.job) return;

    setPanels((current) => ({
      ...current,
      [scope]: {
        ...current[scope],
        loading: true,
        error: null,
      },
    }));

    try {
      const res = await fetch(`/api/jobs/${panel.job.id}/analyze`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Analysis failed");
      setPanels((current) => ({
        ...current,
        [scope]: {
          ...current[scope],
          analysis: data.analysis,
          expandedEdit: 0,
        },
      }));
    } catch (err) {
      setPanels((current) => ({
        ...current,
        [scope]: {
          ...current[scope],
          error: err instanceof Error ? err.message : "Analysis failed",
        },
      }));
    } finally {
      setPanels((current) => ({
        ...current,
        [scope]: {
          ...current[scope],
          loading: false,
        },
      }));
    }
  };

  const value = useMemo(
    () => ({
      getPanel,
      open,
      close,
      hide,
      show,
      runAnalysis,
      setExpandedEdit: (scope: AnalysisPanelScope, i: number | null) => {
        setPanels((current) => ({
          ...current,
          [scope]: {
            ...current[scope],
            expandedEdit: i,
          },
        }));
      },
      setApplied: (scope: AnalysisPanelScope, v: boolean) => {
        setPanels((current) => ({
          ...current,
          [scope]: { ...current[scope], applied: v },
        }));
      },
      setChatOpen: (scope: AnalysisPanelScope, v: boolean) => {
        setPanels((current) => ({
          ...current,
          [scope]: { ...current[scope], chatOpen: v },
        }));
      },
      setChatHistory: (scope: AnalysisPanelScope, history: ChatMessage[]) => {
        setPanels((current) => ({
          ...current,
          [scope]: { ...current[scope], chatHistory: history },
        }));
      },
      setChatLoading: (scope: AnalysisPanelScope, v: boolean) => {
        setPanels((current) => ({
          ...current,
          [scope]: { ...current[scope], chatLoading: v },
        }));
      },
    }),
    [panels]
  );

  return (
    <AnalysisPanelContext.Provider value={value}>
      {children}
    </AnalysisPanelContext.Provider>
  );
}

export function useAnalysisPanel() {
  const ctx = useContext(AnalysisPanelContext);
  if (!ctx) {
    throw new Error("useAnalysisPanel must be used within AnalysisPanelProvider");
  }

  return (scope: AnalysisPanelScope) => {
    const panel = ctx.getPanel(scope);
    return {
      ...panel,
      open: (job: AnalysisJob) => ctx.open(scope, job),
      close: () => ctx.close(scope),
      hide: () => ctx.hide(scope),
      show: () => ctx.show(scope),
      runAnalysis: () => ctx.runAnalysis(scope),
      setExpandedEdit: (i: number | null) => ctx.setExpandedEdit(scope, i),
      setApplied: (v: boolean) => ctx.setApplied(scope, v),
      setChatOpen: (v: boolean) => ctx.setChatOpen(scope, v),
      setChatHistory: (history: ChatMessage[]) => ctx.setChatHistory(scope, history),
      setChatLoading: (v: boolean) => ctx.setChatLoading(scope, v),
    };
  };
}
