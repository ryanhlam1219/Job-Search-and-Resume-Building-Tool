"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { type AnalysisPanelScope, useAnalysisPanel } from "@/frontend/components/jobs/AnalysisPanelProvider";
import type { ChatMessage } from "@/frontend/components/jobs/AnalysisPanelProvider";
import { cn } from "@/backend/lib/utils";
import {
  X, Loader2, Sparkles, ChevronDown, ChevronUp,
  TrendingUp, AlertCircle, CheckCircle2, ArrowRight, Wand2,
  MessageCircle, Send, BookOpen, Target, Maximize2,
} from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import type { JobAnalysis } from "@/backend/lib/types";

// ---------------------------------------------------------------------------
// Suggestion formatters — handle string OR array values from the AI.
// ---------------------------------------------------------------------------

function toText(value: unknown): string {
  if (Array.isArray(value)) return value.map((v) => String(v ?? "")).join(", ");
  if (value == null) return "";
  return String(value);
}

function formatSkillsSuggestion(raw: unknown): string {
  if (Array.isArray(raw))
    return raw.map((v) => String(v ?? "").trim()).filter(Boolean).join(", ");

  const text = String(raw ?? "");
  const withCommas = text
    .replace(/([a-z])([A-Z])/g, "$1, $2")
    .replace(/([A-Z]{2,})([A-Z][a-z])/g, "$1, $2");

  return withCommas
    .split(/[\n,;\u2022]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .join(", ");
}

function parseExperienceBullets(raw: unknown): string[] {
  if (Array.isArray(raw))
    return raw.map((v) => String(v ?? "").trim()).filter(Boolean);

  const cleaned = String(raw ?? "")
    .replace(/\r/g, "")
    .replace(/^\s*[-*\u2022]\s*/gm, "")
    .trim();

  const byNewline = cleaned.split(/\n+|\u2022|;/).map((s) => s.trim()).filter(Boolean);
  if (byNewline.length > 1) return byNewline;

  return cleaned.split(/(?<=[.!?])\s+(?=[A-Z])/).map((s) => s.trim()).filter(Boolean);
}

/**
 * Walk React children and replace literal `<br>` / `<br/>` strings with real
 * <br /> elements so AI-generated table cells render correctly.
 */
function renderWithBr(children: React.ReactNode): React.ReactNode {
  if (typeof children === "string") {
    const parts = children.split(/(<br\s*\/?>)/gi);
    if (parts.length === 1) return children;
    return parts.map((part, i) =>
      /^<br\s*\/?>$/i.test(part) ? <br key={i} /> : part
    );
  }
  if (Array.isArray(children)) {
    return children.map((child, i) => (
      <React.Fragment key={i}>{renderWithBr(child)}</React.Fragment>
    ));
  }
  if (React.isValidElement<{ children?: React.ReactNode }>(children)) {
    return React.cloneElement(
      children as React.ReactElement<{ children?: React.ReactNode }>,
      {},
      renderWithBr((children as React.ReactElement<{ children?: React.ReactNode }>).props.children)
    );
  }
  return children;
}

function renderSuggestionText(
  section: string,
  raw: unknown,
  className: string
): React.ReactNode {
  if (section === "skills")
    return <p className={className}>{formatSkillsSuggestion(raw)}</p>;

  if (section === "experience") {
    const bullets = parseExperienceBullets(raw);
    if (bullets.length > 1)
      return (
        <ul className="list-disc pl-4 space-y-1">
          {bullets.map((b, i) => <li key={i} className={className}>{b}</li>)}
        </ul>
      );
  }

  return <p className={className}>{toText(raw)}</p>;
}

/**
 * Inline AI analysis panel that reads all state from AnalysisPanelProvider.
 * Because state lives in the global provider, it persists across route changes.
 * Render this wherever you want the panel to appear (right column, side panel, etc.)
 */
export function AnalysisPanelContent({ scope }: { scope: AnalysisPanelScope }) {
  const panel = useAnalysisPanel();
  const {
    job,
    analysis,
    loading,
    error,
    expandedEdit,
    applied,
    chatOpen,
    chatHistory,
    close,
    runAnalysis,
    setExpandedEdit,
    setApplied,
    setChatOpen,
    setChatHistory,
  } = panel(scope);
  const router = useRouter();

  // Chat input is still local (ephemeral typing state)
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Active tab in results view
  const [activeTab, setActiveTab] = useState<"overview" | "devplan" | "edits">("overview");

  // Expanded table modal
  const [expandedTable, setExpandedTable] = useState<React.ReactNode | null>(null);

  // Auto-analyze when a new job is opened with no analysis yet
  useEffect(() => {
    if (job && !analysis && !loading && !error) {
      runAnalysis();
    }
    // Reset chat INPUT only (not history) when job changes — history lives in provider
    setChatInput("");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.id]);

  // Scroll chat to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, chatLoading]);

  if (!job) return null;

  const applyToResume = () => {
    if (!analysis?.tailoredResume) return;
    sessionStorage.setItem(
      "pendingTailoredResume",
      JSON.stringify({
        resume: analysis.tailoredResume,
        jobTitle: job.title,
        company: job.company,
      })
    );
    setApplied(true);
    setTimeout(() => {
      router.push("/resume");
    }, 800);
  };

  const sendChat = async () => {
    const msg = chatInput.trim();
    if (!msg || chatLoading) return;
    setChatInput("");
    const newHistory: ChatMessage[] = [...chatHistory, { role: "user" as const, content: msg }];
    setChatHistory(newHistory);
    setChatLoading(true);
    try {
      const res = await fetch(`/api/jobs/${job.id}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, history: chatHistory, analysis }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Chat failed");
      setChatHistory([...newHistory, { role: "assistant", content: data.reply }]);
    } catch (err) {
      setChatHistory([...newHistory, { role: "assistant", content: `Sorry, something went wrong: ${err instanceof Error ? err.message : "unknown error"}` }]);
    } finally {
      setChatLoading(false);
    }
  };

  const scoreColor =
    !analysis ? "" :
    analysis.matchScore >= 75 ? "text-green-400" :
    analysis.matchScore >= 50 ? "text-yellow-400" : "text-red-400";

  const scoreBg =
    !analysis ? "" :
    analysis.matchScore >= 75 ? "bg-green-500/10 border-green-500/30" :
    analysis.matchScore >= 50 ? "bg-yellow-500/10 border-yellow-500/30" : "bg-red-500/10 border-red-500/30";

  const priorityStyle = (p: string) =>
    p === "critical" ? "bg-red-500/15 text-red-300 border-red-500/25" :
    p === "high" ? "bg-orange-500/15 text-orange-300 border-orange-500/25" :
    "bg-gray-500/15 text-gray-300 border-gray-500/25";

  return (
    <div className="h-full flex flex-col bg-gray-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden">

      {/* Header */}
      <div className="flex items-start justify-between p-4 border-b border-white/10 flex-shrink-0">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <Sparkles size={14} className="text-violet-400 flex-shrink-0" />
            <span className="text-violet-400 text-xs font-semibold uppercase tracking-wider">AI Job Analysis</span>
          </div>
          <h2 className="text-white font-bold text-sm leading-tight truncate">{job.title}</h2>
          <p className="text-gray-400 text-xs truncate">{job.company}{job.location ? ` · ${job.location}` : ""}</p>
        </div>
        <div className="flex items-center gap-1 ml-2 flex-shrink-0">
          {analysis && !loading && (
            <button
              type="button"
              onClick={() => setChatOpen(!chatOpen)}
              title="Ask AI Coach"
              className={cn(
                "p-1.5 rounded-lg transition-colors",
                chatOpen
                  ? "bg-violet-500/20 text-violet-300"
                  : "text-gray-500 hover:text-violet-400 hover:bg-violet-500/10"
              )}
            >
              <MessageCircle size={16} />
            </button>
          )}
          <button type="button" onClick={close} className="text-gray-500 hover:text-white p-1.5">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Chat panel — slides in over body when open */}
      {chatOpen && analysis && (
        <div className="flex flex-col flex-1 overflow-hidden border-b border-white/10">
          {/* Chat header */}
          <div className="flex items-center justify-between px-3 py-2 bg-violet-500/5 border-b border-white/10 flex-shrink-0">
            <div className="flex items-center gap-1.5">
              <MessageCircle size={13} className="text-violet-400" />
              <span className="text-violet-300 text-xs font-semibold">AI Career Coach</span>
            </div>
            <button type="button" onClick={() => setChatOpen(false)} className="text-gray-500 hover:text-white">
              <ChevronDown size={14} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden p-3 space-y-3">
            {chatHistory.length === 0 && (
              <div className="text-center py-4">
                <p className="text-gray-400 text-xs mb-3">Ask anything about this analysis or your application strategy</p>
                <div className="flex flex-col gap-1.5">
                  {[
                    "How can I improve my match score?",
                    "What's the fastest way to close the skill gaps?",
                    "What should I emphasize in my cover letter?",
                  ].map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => { setChatInput(q); }}
                      className="text-left text-xs px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:bg-violet-500/10 hover:border-violet-500/20 hover:text-violet-200 transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {chatHistory.map((msg, i) => (
              <div key={i} className={msg.role === "user" ? "flex justify-end" : "block"}>
                <div
                  className={cn(
                    "rounded-xl px-3 py-2 text-xs",
                    msg.role === "user"
                      ? "inline-block max-w-[85%] bg-violet-600/30 text-white rounded-br-sm"
                      : "w-full bg-white/5 border border-white/10 text-gray-200 rounded-bl-sm"
                  )}
                  style={{ wordBreak: "break-word", overflowWrap: "anywhere" }}
                >
                  {msg.role === "assistant" ? (
                    <div className="prose prose-invert prose-sm min-w-0 max-w-full break-words [&_p]:text-xs [&_p]:my-1 [&_ul]:text-xs [&_ul]:pl-4 [&_li]:my-0.5 [&_h2]:text-xs [&_h2]:font-semibold [&_h2]:text-white [&_h2]:mt-2 [&_strong]:text-white [&_table]:text-xs">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          table: ({ children }) => (
                            <div className="relative group overflow-x-auto my-2 rounded-lg border border-white/10">
                              <button
                                type="button"
                                onClick={() => setExpandedTable(children)}
                                title="Expand table"
                                className="absolute top-1.5 right-1.5 z-10 opacity-0 group-hover:opacity-100 p-1 rounded bg-white/10 hover:bg-violet-500/30 text-gray-400 hover:text-violet-300 transition-all"
                              >
                                <Maximize2 size={11} />
                              </button>
                              <table className="min-w-max border-collapse text-xs">{children}</table>
                            </div>
                          ),
                          thead: ({ children }) => <thead className="bg-white/5">{children}</thead>,
                          th: ({ children }) => (
                            <th className="px-3 py-1.5 text-left text-xs font-semibold text-gray-300 border-b border-white/10 whitespace-nowrap">{children}</th>
                          ),
                          td: ({ children }) => (
                            <td className="px-3 py-1.5 text-xs text-gray-300 border-b border-white/5 align-top" style={{ wordBreak: "normal", overflowWrap: "normal", whiteSpace: "normal" }}>{renderWithBr(children)}</td>
                          ),
                          tr: ({ children }) => <tr className="hover:bg-white/3 transition-colors">{children}</tr>,
                          pre: ({ children }) => (
                            <pre className="whitespace-pre-wrap break-words overflow-x-hidden bg-white/5 rounded-lg p-2 my-1 text-xs">{children}</pre>
                          ),
                          code: ({ children, className: cls }) =>
                            cls ? (
                              <code className="whitespace-pre-wrap break-words text-xs">{children}</code>
                            ) : (
                              <code className="bg-white/10 text-violet-300 rounded px-1 py-0.5 text-xs break-all">{children}</code>
                            ),
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    msg.content
                  )}
                </div>
              </div>
            ))}
            {chatLoading && (
              <div className="flex justify-start">
                <div className="bg-white/5 border border-white/10 rounded-xl rounded-bl-sm px-3 py-2">
                  <Loader2 size={12} className="text-violet-400 animate-spin" />
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div className="flex-shrink-0 p-2 border-t border-white/10 flex gap-2">
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendChat()}
              placeholder="Ask about skills, strategy, resume…"
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-violet-500/50"
            />
            <button
              type="button"
              onClick={sendChat}
              disabled={!chatInput.trim() || chatLoading}
              className="w-7 h-7 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-40 flex items-center justify-center flex-shrink-0 transition-colors"
            >
              <Send size={12} className="text-white" />
            </button>
          </div>
        </div>
      )}

      {/* Analysis body — hidden when chat is open */}
      {!chatOpen && (
        <>
          <div className="flex-1 overflow-y-auto">
            {/* Loading */}
            {loading && (
              <div className="flex flex-col items-center justify-center py-10 gap-3 px-5">
                <Loader2 size={32} className="text-violet-400 animate-spin" />
                <p className="text-gray-400 text-sm">Analyzing your resume against this job…</p>
                <p className="text-gray-600 text-xs">This may take 15–30 seconds</p>
              </div>
            )}

            {/* Error */}
            {error && !loading && (
              <div className="m-4 bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-center">
                <p className="text-red-400 text-sm mb-3">{error}</p>
                <button onClick={runAnalysis} className="text-xs text-red-400 hover:text-red-300 underline">
                  Try again
                </button>
              </div>
            )}

            {/* Results */}
            {analysis && !loading && (
              <div className="flex flex-col">
                {/* Score bar */}
                <div className={cn("mx-4 mt-4 rounded-xl border p-3 flex items-start gap-3", scoreBg)}>
                  <div className="text-center flex-shrink-0">
                    <div className={cn("text-3xl font-black leading-none", scoreColor)}>{analysis.matchScore}</div>
                    <div className="text-gray-500 text-[10px]">/ 100</div>
                  </div>
                  <p className="text-gray-300 text-xs leading-relaxed">{analysis.summary}</p>
                </div>

                {/* Tab bar */}
                <div className="flex gap-1 px-4 pt-3 pb-0 flex-shrink-0">
                  {([
                    { id: "overview", label: "Overview", icon: Target },
                    { id: "devplan", label: "Growth Plan", icon: BookOpen },
                    { id: "edits", label: "Edits", icon: TrendingUp },
                  ] as const).map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setActiveTab(id)}
                      className={cn(
                        "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors border",
                        activeTab === id
                          ? "bg-violet-500/20 border-violet-500/30 text-violet-300"
                          : "bg-white/3 border-white/10 text-gray-400 hover:text-white hover:bg-white/8"
                      )}
                    >
                      <Icon size={11} />
                      {label}
                    </button>
                  ))}
                </div>

                {/* Tab content */}
                <div className="px-4 py-3 space-y-3">

                  {/* Overview tab */}
                  {activeTab === "overview" && (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-3">
                          <div className="flex items-center gap-1.5 mb-2">
                            <CheckCircle2 size={12} className="text-green-400" />
                            <span className="text-green-400 text-xs font-semibold">Strengths</span>
                          </div>
                          <ul className="space-y-1.5">
                            {analysis.strengths.map((s, i) => (
                              <li key={i} className="text-gray-300 text-xs leading-snug flex items-start gap-1">
                                <span className="text-green-500 mt-0.5 flex-shrink-0">✓</span>{s}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-3">
                          <div className="flex items-center gap-1.5 mb-2">
                            <AlertCircle size={12} className="text-red-400" />
                            <span className="text-red-400 text-xs font-semibold">Gaps</span>
                          </div>
                          <ul className="space-y-1.5">
                            {analysis.gaps.map((g, i) => (
                              <li key={i} className="text-gray-300 text-xs leading-snug flex items-start gap-1">
                                <span className="text-red-400 mt-0.5 flex-shrink-0">✗</span>{g}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                      {/* Prompt to explore further */}
                      <button
                        type="button"
                        onClick={() => setChatOpen(true)}
                        className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-violet-500/20 bg-violet-500/5 text-violet-300 text-xs hover:bg-violet-500/10 transition-colors"
                      >
                        <MessageCircle size={12} />
                        Ask AI Coach for deeper guidance
                      </button>
                    </>
                  )}

                  {/* Development Plan tab */}
                  {activeTab === "devplan" && (
                    <div className="space-y-3">
                      {(!analysis.developmentPlan || analysis.developmentPlan.length === 0) ? (
                        <p className="text-gray-500 text-xs text-center py-6">No development plan generated. Try re-running the analysis.</p>
                      ) : (
                        analysis.developmentPlan.map((item, i) => (
                          <div key={i} className="bg-white/3 border border-white/10 rounded-xl overflow-hidden">
                            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-white/10">
                              <span className={cn("text-[10px] px-2 py-0.5 rounded-full border font-semibold capitalize", priorityStyle(item.priority))}>
                                {item.priority}
                              </span>
                              <span className="text-white text-xs font-semibold flex-1">{item.skill}</span>
                            </div>
                            <div className="px-3 py-2.5 space-y-2.5">
                              <p className="text-gray-400 text-xs leading-relaxed">{item.gap}</p>

                              <div>
                                <p className="text-violet-300 text-[10px] font-semibold uppercase tracking-wide mb-1.5">How to build this skill</p>
                                <ul className="space-y-1">
                                  {(item.howToDevelop ?? []).map((step, j) => (
                                    <li key={j} className="text-gray-300 text-xs flex items-start gap-1.5 leading-snug">
                                      <span className="text-violet-400 mt-0.5 flex-shrink-0 font-bold text-[10px]">{j + 1}.</span>{step}
                                    </li>
                                  ))}
                                </ul>
                              </div>

                              <div>
                                <p className="text-green-300 text-[10px] font-semibold uppercase tracking-wide mb-1.5">Add to your resume</p>
                                <ul className="space-y-1">
                                  {(item.resumeEvidence ?? []).map((ev, j) => (
                                    <li key={j} className="text-gray-300 text-xs flex items-start gap-1.5 leading-snug">
                                      <span className="text-green-400 mt-0.5 flex-shrink-0">→</span>{ev}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* Edits tab */}
                  {activeTab === "edits" && (
                    <div className="space-y-2">
                      {(!analysis.suggestedEdits || analysis.suggestedEdits.length === 0) ? (
                        <p className="text-gray-500 text-xs text-center py-6">No suggested edits generated.</p>
                      ) : (
                        analysis.suggestedEdits.map((edit, i) => (
                          <div key={i} className="bg-white/3 border border-white/10 rounded-xl overflow-hidden">
                            <div
                              onClick={() => setExpandedEdit(expandedEdit === i ? null : i)}
                              className="flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-white/5"
                            >
                              <span className="text-xs px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300 font-medium capitalize flex-shrink-0">
                                {edit.section}
                              </span>
                              <span className="text-white text-xs font-medium flex-1 truncate">{edit.label}</span>
                              {expandedEdit === i
                                ? <ChevronUp size={12} className="text-gray-500 flex-shrink-0" />
                                : <ChevronDown size={12} className="text-gray-500 flex-shrink-0" />}
                            </div>
                            {expandedEdit === i && (
                              <div className="px-3 pb-3 flex flex-col gap-2 border-t border-white/10 pt-2">
                                <div className="bg-red-500/5 border border-red-500/15 rounded-lg p-2">
                                  <p className="text-gray-500 text-xs mb-0.5 uppercase tracking-wide">Before</p>
                                  {renderSuggestionText(edit.section, edit.before, "text-gray-400 text-xs leading-relaxed line-clamp-3")}
                                </div>
                                <div className="flex justify-center text-gray-600"><ArrowRight size={12} /></div>
                                <div className="bg-green-500/5 border border-green-500/15 rounded-lg p-2">
                                  <p className="text-gray-500 text-xs mb-0.5 uppercase tracking-wide">After</p>
                                  {renderSuggestionText(edit.section, edit.after, "text-gray-300 text-xs leading-relaxed")}
                                </div>
                                <p className="text-violet-300/70 text-xs italic">→ {edit.reason}</p>
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-white/10 flex gap-2 flex-shrink-0">
            {analysis ? (
              <>
                <button
                  type="button"
                  onClick={runAnalysis}
                  disabled={loading}
                  className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 text-xs rounded-xl transition-colors disabled:opacity-50"
                >
                  Re-run
                </button>
                <button
                  type="button"
                  onClick={applyToResume}
                  disabled={applied}
                  className="flex-1 flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:bg-green-600 text-white font-semibold text-xs rounded-xl py-2 transition-colors"
                >
                  {applied
                    ? <><CheckCircle2 size={13} /> Applied! Going to Resume…</>
                    : <><Wand2 size={13} /> Apply Edits to Resume</>}
                </button>
              </>
            ) : (
              !loading && error && (
                <button
                  type="button"
                  onClick={runAnalysis}
                  className="flex-1 flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 text-white font-semibold text-xs rounded-xl py-2 transition-colors"
                >
                  <Sparkles size={13} /> Retry Analysis
                </button>
              )
            )}
          </div>
        </>
      )}

      {/* Expanded table modal */}
      <Dialog.Root open={!!expandedTable} onOpenChange={(open) => { if (!open) setExpandedTable(null); }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-4xl max-h-[80vh] flex flex-col bg-gray-900 border border-white/10 rounded-2xl shadow-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
            {/* Modal header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 flex-shrink-0">
              <div className="flex items-center gap-2">
                <Maximize2 size={13} className="text-violet-400" />
                <Dialog.Title className="text-white text-sm font-semibold m-0">Table View</Dialog.Title>
              </div>
              <Dialog.Close asChild>
                <button type="button" className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-colors">
                  <X size={15} />
                </button>
              </Dialog.Close>
            </div>
            {/* Modal body — scrollable */}
            <div className="flex-1 overflow-auto p-4 font-sans">
              <table className="w-full border-collapse [&_thead]:bg-white/5 [&_th]:px-4 [&_th]:py-2.5 [&_th]:text-left [&_th]:text-sm [&_th]:font-semibold [&_th]:text-gray-200 [&_th]:border-b [&_th]:border-white/10 [&_th]:whitespace-nowrap [&_td]:px-4 [&_td]:py-3 [&_td]:text-sm [&_td]:text-gray-300 [&_td]:leading-relaxed [&_td]:border-b [&_td]:border-white/5 [&_td]:align-top [&_tr:hover_td]:bg-white/3">
                {expandedTable}
              </table>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

