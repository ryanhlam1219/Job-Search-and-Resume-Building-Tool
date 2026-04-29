"use client";

import { useState, useCallback, useRef } from "react"; // useState kept for swipeDir + SwipeCard's expanded
import { motion, useMotionValue, useTransform, AnimatePresence } from "framer-motion";
import { X, Heart, ThumbsUp, MapPin, Building2, DollarSign, ExternalLink, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { Job, SwipeAction } from "@/backend/lib/types";
import { cn } from "@/backend/lib/utils";
import { useAnalysisPanel } from "@/frontend/components/jobs/AnalysisPanelProvider";
import { AnalysisPanelContent } from "@/frontend/components/jobs/AnalysisPanelContent";

interface SwipeCardProps {
  job: Job;
  onSwipe: (action: SwipeAction) => void;
  isTop: boolean;
}

function SwipeCard({ job, onSwipe, isTop }: SwipeCardProps) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-20, 20]);
  const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0, 1, 1, 1, 0]);

  const likeOpacity = useTransform(x, [0, 80], [0, 1]);
  const nopeOpacity = useTransform(x, [-80, 0], [1, 0]);

  const [expanded, setExpanded] = useState(false);

  const handleDragEnd = useCallback(
    (_: unknown, info: { offset: { x: number } }) => {
      if (info.offset.x > 100) onSwipe("INTERESTED");
      else if (info.offset.x < -100) onSwipe("NOT_INTERESTED");
    },
    [onSwipe]
  );

  return (
    <motion.div
      style={{ x, rotate, opacity }}
      drag={isTop ? "x" : false}
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      dragElastic={0.8}
      onDragEnd={handleDragEnd}
      className={cn(
        "absolute inset-0 rounded-3xl overflow-hidden cursor-grab active:cursor-grabbing",
        "bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900",
        "border border-white/10 shadow-2xl",
        !isTop && "pointer-events-none"
      )}
      whileDrag={{ scale: 1.02 }}
    >
      {/* LIKE / NOPE overlays */}
      <motion.div
        style={{ opacity: likeOpacity }}
        className="absolute top-6 left-6 z-20 border-4 border-green-400 rounded-xl px-4 py-1 rotate-[-15deg]"
      >
        <span className="text-green-400 font-black text-2xl tracking-widest">LIKE</span>
      </motion.div>
      <motion.div
        style={{ opacity: nopeOpacity }}
        className="absolute top-6 right-6 z-20 border-4 border-red-400 rounded-xl px-4 py-1 rotate-[15deg]"
      >
        <span className="text-red-400 font-black text-2xl tracking-widest">NOPE</span>
      </motion.div>

      {/* Card content */}
      <div className="h-full flex flex-col p-6 select-none">
        {/* Match score badge */}
        {job.matchScore !== undefined && (
          <div className="flex justify-end mb-2">
            <span className={cn(
              "text-xs font-bold px-3 py-1 rounded-full",
              job.matchScore >= 75 ? "bg-green-500/20 text-green-400 border border-green-500/30" :
              job.matchScore >= 50 ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30" :
              "bg-gray-500/20 text-gray-400 border border-gray-500/30"
            )}>
              {job.matchScore}% match
            </span>
          </div>
        )}

        {/* Header */}
        <div className="mb-4">
          <h2 className="text-white font-bold text-xl leading-tight mb-1">{job.title}</h2>
          <div className="flex items-center gap-1.5 text-gray-300 text-sm mb-1">
            <Building2 size={14} className="text-violet-400" />
            <span>{job.company}</span>
          </div>
          {job.location && (
            <div className="flex items-center gap-1.5 text-gray-400 text-sm">
              <MapPin size={14} className="text-violet-400" />
              <span>{job.location}</span>
            </div>
          )}
          {job.salary && (
            <div className="flex items-center gap-1.5 text-green-400 text-sm mt-1">
              <DollarSign size={14} />
              <span>{job.salary}</span>
            </div>
          )}
        </div>

        {/* Source badge */}
        <div className="mb-3">
          <span className="text-xs text-violet-400 bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded-full capitalize">
            via {job.source}
          </span>
        </div>

        {/* Description */}
        <div className="flex-1 overflow-auto">
          <div className={cn(
            "text-gray-300 text-sm leading-relaxed prose prose-invert prose-sm max-w-none",
            "prose-headings:text-white prose-headings:font-semibold",
            "prose-strong:text-white prose-ul:pl-4 prose-li:my-0.5",
            "prose-p:my-1 prose-h3:text-sm prose-h2:text-base",
            !expanded && "line-clamp-[12]"
          )}>
            <ReactMarkdown>{job.description || ""}</ReactMarkdown>
          </div>
          {job.description && job.description.length > 400 && (
            <button
              onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
              className="text-violet-400 text-xs mt-1 hover:text-violet-300"
            >
              {expanded ? "Show less" : "Show more"}
            </button>
          )}
        </div>

        {/* Match reasons */}
        {job.matchReasons && job.matchReasons.length > 0 && (
          <div className="mt-3 space-y-1">
            {job.matchReasons.slice(0, 2).map((reason, i) => (
              <p key={i} className="text-xs text-gray-400 flex items-start gap-1">
                <span className="text-violet-400 mt-0.5">✓</span>
                {reason}
              </p>
            ))}
          </div>
        )}

        {/* View link */}
        {job.url && (
          <a
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="mt-3 flex items-center gap-1 text-xs text-gray-500 hover:text-violet-400 transition-colors"
          >
            <ExternalLink size={11} /> View original posting
          </a>
        )}
      </div>
    </motion.div>
  );
}

interface SwipeInterfaceProps {
  stack: Job[];
  onSwipe: (jobId: string, action: SwipeAction) => void;
  onStackChange: (newStack: Job[]) => void;
  onEmpty?: () => void;
}

const CARD_WIDTH = 400;
const CARD_HEIGHT = 560;

export function SwipeInterface({ stack, onSwipe, onStackChange, onEmpty }: SwipeInterfaceProps) {
  const analysisPanel = useAnalysisPanel();
  const [swipeDir, setSwipeDir] = useState<"left" | "right" | null>(null);
  const swipePending = useRef(false);
  const { job: analysisJob, visible: analysisVisible, open: openAnalysis, close: closeAnalysis } = analysisPanel("discover");

  const handleSwipe = useCallback(
    (action: SwipeAction) => {
      if (stack.length === 0 || swipePending.current) return;
      swipePending.current = true;
      const job = stack[stack.length - 1];
      const dir: "left" | "right" = action === "NOT_INTERESTED" ? "left" : "right";
      setSwipeDir(dir);
      onSwipe(job.id, action);
      setTimeout(() => {
        const newStack = stack.slice(0, -1);
        onStackChange(newStack);
        setSwipeDir(null);
        swipePending.current = false;
        if (newStack.length === 0) {
          closeAnalysis();
          onEmpty?.();
        }
      }, 320);
    },
    [stack, onSwipe, onStackChange, onEmpty, closeAnalysis]
  );

  const topJob = stack[stack.length - 1];
  const panelOpen = analysisVisible && analysisJob !== null;

  if (stack.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
        <div className="w-20 h-20 rounded-full bg-violet-500/10 border border-violet-500/30 flex items-center justify-center text-4xl">
          🎉
        </div>
        <h3 className="text-white font-bold text-xl">All caught up!</h3>
        <p className="text-gray-400 text-sm">Check back later for more jobs,<br />or search with different criteria.</p>
      </div>
    );
  }

  const visibleCards = stack.slice(-3);

  return (
    <div className="relative w-full flex items-start" style={{ minHeight: `${CARD_HEIGHT + 200}px`, overflowX: "clip" }}>
      {/* Card column — centered when solo, shifts left when panel opens */}
      <div
        className="flex flex-col items-center gap-4 flex-shrink-0 transition-[margin] duration-300 ease-in-out"
        style={{
          width: CARD_WIDTH,
          marginLeft: panelOpen ? 0 : "auto",
          marginRight: panelOpen ? 0 : "auto",
        }}
      >
        {/* Card stack */}
        <div className="relative w-full" style={{ height: CARD_HEIGHT }}>
          <AnimatePresence>
            {visibleCards.map((job, idx) => {
              const isTop = idx === visibleCards.length - 1;
              const offset = visibleCards.length - 1 - idx;
              return (
                <motion.div
                  key={job.id}
                  className="absolute inset-0"
                  style={{ zIndex: idx }}
                  initial={{ scale: 0.95 - offset * 0.03, y: offset * 8, x: 0, opacity: 1 }}
                  animate={{
                    scale: 0.95 - offset * 0.03,
                    y: offset * 8,
                    x: isTop && swipeDir ? (swipeDir === "right" ? 420 : -420) : 0,
                    opacity: isTop && swipeDir ? 0 : 1,
                  }}
                  transition={isTop && swipeDir ? { duration: 0.3, ease: "easeOut" } : { type: "spring", stiffness: 300, damping: 25 }}
                  exit={{ opacity: 0 }}
                >
                  <SwipeCard
                    job={job}
                    onSwipe={handleSwipe}
                    isTop={isTop}
                  />
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Analyze button — always below card, moves with it */}
        <button
          type="button"
          onClick={() => {
            if (panelOpen && analysisJob?.id === topJob?.id) {
              closeAnalysis();
            } else if (topJob) {
              openAnalysis(topJob);
            }
          }}
          className={cn(
            "w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all border",
            panelOpen
              ? "bg-violet-500/20 border-violet-400/40 text-violet-300"
              : "bg-violet-500/10 hover:bg-violet-500/20 border-violet-500/20 text-violet-300"
          )}
        >
          <Sparkles size={14} />
          {panelOpen ? "Analysis Open" : "Analyze with AI"}
        </button>

        {/* Action buttons */}
        <div className="flex items-center gap-6">
          <button
            type="button"
            onClick={() => handleSwipe("NOT_INTERESTED")}
            className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 hover:bg-red-500/20 hover:scale-110 transition-all"
            title="Not interested"
          >
            <X size={22} />
          </button>
          <button
            type="button"
            onClick={() => handleSwipe("HIGH_PRIORITY")}
            className="w-16 h-16 rounded-full bg-pink-500/10 border border-pink-500/30 flex items-center justify-center text-pink-400 hover:bg-pink-500/20 hover:scale-110 transition-all"
            title="High priority"
          >
            <Heart size={26} />
          </button>
          <button
            type="button"
            onClick={() => handleSwipe("INTERESTED")}
            className="w-14 h-14 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center text-green-400 hover:bg-green-500/20 hover:scale-110 transition-all"
            title="Interested"
          >
            <ThumbsUp size={22} />
          </button>
        </div>

        <p className="text-gray-500 text-xs">
          {stack.length} job{stack.length !== 1 ? "s" : ""} remaining
        </p>
      </div>

      {/* Analysis panel — slides in from right, state persists across route changes */}
      <AnimatePresence>
        {panelOpen && (
          <motion.div
            key={analysisJob?.id}
            className="flex-1 min-w-0 ml-4"
            style={{ height: CARD_HEIGHT }}
            initial={{ opacity: 0, x: 60 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 60 }}
            transition={{ type: "spring", stiffness: 280, damping: 28 }}
          >
            <AnalysisPanelContent scope="discover" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
