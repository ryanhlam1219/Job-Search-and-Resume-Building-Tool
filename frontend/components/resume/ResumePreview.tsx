"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import type { ResumeData, ReviewHighlights, ReviewRating } from "@/backend/lib/types";
import { cn } from "@/backend/lib/utils";

interface ResumePreviewProps {
  data: ResumeData;
  onFitChange?: (fits: boolean, adjustments: string[]) => void;
  className?: string;
  printMode?: boolean;
  highlights?: ReviewHighlights;
}

const RATING_BORDER: Record<ReviewRating, string> = {
  good: "#10b981",
  ok: "#f59e0b",
  weak: "#ef4444",
};

function sectionHighlight(rating: ReviewRating | undefined, printMode: boolean): React.CSSProperties {
  if (!rating || printMode) return {};
  return { borderLeft: `3px solid ${RATING_BORDER[rating]}`, paddingLeft: "6px" };
}

const PAGE_HEIGHT = 1056; // 11in at 96dpi
const PAGE_WIDTH = 816;   // 8.5in at 96dpi
const MIN_FONT_SIZE = 10;
const BASE_FONT_SIZE = 11;

export function ResumePreview({ data, onFitChange, className, printMode = false, highlights }: ResumePreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [fontSize, setFontSize] = useState(BASE_FONT_SIZE);
  const [spacing, setSpacing] = useState<"normal" | "tight" | "ultra-tight">("normal");
  const [visibleRoles, setVisibleRoles] = useState(data.experience?.length || 0);
  const [bulletsPerRole, setBulletsPerRole] = useState(5);
  const [adjustments, setAdjustments] = useState<string[]>([]);
  const [fits, setFits] = useState(true);

  // Reset when data changes
  useEffect(() => {
    setFontSize(BASE_FONT_SIZE);
    setSpacing("normal");
    setVisibleRoles(data.experience?.length || 0);
    setBulletsPerRole(5);
    setAdjustments([]);
  }, [data]);

  const measureAndAdjust = useCallback(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const scrollH = el.scrollHeight;

    if (scrollH <= PAGE_HEIGHT) {
      setFits(true);
      onFitChange?.(true, adjustments);
      return;
    }

    const newAdjustments: string[] = [...adjustments];

    // Step 1: Reduce bullets per role (5 → 4 → 3 → 2 → 1)
    if (bulletsPerRole > 1) {
      const next = bulletsPerRole - 1;
      setBulletsPerRole(next);
      newAdjustments.push(`Reduced bullets to ${next} per role`);
      setAdjustments(newAdjustments);
      return;
    }

    // Step 2: Reduce spacing
    if (spacing === "normal") {
      setSpacing("tight");
      newAdjustments.push("Tightened spacing");
      setAdjustments(newAdjustments);
      return;
    }
    if (spacing === "tight") {
      setSpacing("ultra-tight");
      newAdjustments.push("Applied ultra-tight spacing");
      setAdjustments(newAdjustments);
      return;
    }

    // Step 3: Remove least relevant roles
    if (visibleRoles > 1) {
      const next = visibleRoles - 1;
      setVisibleRoles(next);
      newAdjustments.push(`Removed oldest role (showing ${next})`);
      setAdjustments(newAdjustments);
      return;
    }

    // Step 4: Reduce font size (down to min)
    if (fontSize > MIN_FONT_SIZE) {
      const next = Math.max(MIN_FONT_SIZE, fontSize - 0.5);
      setFontSize(next);
      newAdjustments.push(`Reduced font to ${next}px`);
      setAdjustments(newAdjustments);
      return;
    }

    // Cannot reduce further
    setFits(false);
    onFitChange?.(false, newAdjustments);
  }, [adjustments, bulletsPerRole, spacing, visibleRoles, fontSize, onFitChange]);

  useEffect(() => {
    const timeout = setTimeout(measureAndAdjust, 50);
    return () => clearTimeout(timeout);
  }, [measureAndAdjust, data, fontSize, spacing, visibleRoles, bulletsPerRole]);

  useEffect(() => {
    onFitChange?.(fits, adjustments);
  }, [fits, adjustments, onFitChange]);

  const spacingClasses = {
    normal: { section: "mb-3", item: "mb-2", bullet: "mb-1" },
    tight: { section: "mb-2", item: "mb-1.5", bullet: "mb-0.5" },
    "ultra-tight": { section: "mb-1", item: "mb-1", bullet: "mb-0" },
  };
  const sp = spacingClasses[spacing];

  const displayedExperience = (data.experience || []).slice(0, visibleRoles);

  return (
    <div
      ref={containerRef}
      data-resume-ready
      className={cn(
        "bg-white text-gray-900 overflow-hidden",
        "font-['Arial','Helvetica',sans-serif]",
        printMode ? "" : "shadow-lg",
        className
      )}
      style={{
        width: `${PAGE_WIDTH}px`,
        height: `${PAGE_HEIGHT}px`,
        fontSize: `${fontSize}px`,
        lineHeight: 1.35,
        padding: "36px 48px",
        boxSizing: "border-box",
      }}
    >
      {/* Header */}
      <div className={cn("text-center border-b border-gray-300 pb-3", sp.section)}>
        <h1 style={{ fontSize: `${fontSize + 8}px`, fontWeight: 700, letterSpacing: "0.05em" }}>
          {data.name || "Your Name"}
        </h1>
        {data.title && (
          <p style={{ fontSize: `${fontSize + 1}px`, color: "#4B5563", marginTop: "2px" }}>
            {data.title}
          </p>
        )}
        <p style={{ fontSize: `${fontSize - 1}px`, color: "#6B7280", marginTop: "4px" }}>
          {[data.email, data.phone, data.location, data.linkedin]
            .filter(Boolean)
            .join(" • ")}
        </p>
      </div>

      {/* Summary */}
      {data.summary && (
        <div className={sp.section} style={sectionHighlight(highlights?.summary, printMode)}>
          <SectionHeader>Summary</SectionHeader>
          <p style={{ fontSize: `${fontSize}px`, color: "#374151", lineHeight: 1.4 }}>
            {data.summary}
          </p>
        </div>
      )}

      {/* Experience */}
      {displayedExperience.length > 0 && (
        <div className={sp.section}>
          <SectionHeader>Experience</SectionHeader>
          {displayedExperience.map((exp, i) => (
            <div key={i} className={sp.item} style={sectionHighlight(highlights?.experience?.[i], printMode)}>
              <div className="flex justify-between items-baseline">
                <span style={{ fontSize: `${fontSize}px`, fontWeight: 700 }}>
                  {exp.role}
                </span>
                <span style={{ fontSize: `${fontSize - 1}px`, color: "#6B7280" }}>
                  {exp.startDate} – {exp.endDate}
                </span>
              </div>
              <p style={{ fontSize: `${fontSize - 0.5}px`, color: "#4B5563", marginBottom: "3px" }}>
                {exp.company}
              </p>
<div style={{ marginTop: "2px" }}>
                {(exp.bullets || []).slice(0, bulletsPerRole).map((bullet, j) => (
                  <div key={j} className={cn(sp.bullet)}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "6px",
                        fontSize: `${fontSize}px`,
                        color: "#374151",
                        lineHeight: 1.4,
                      }}>
                    <span style={{ flexShrink: 0, marginTop: "1px" }}>•</span>
                    <span>{bullet}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Skills */}
      {data.skills && data.skills.length > 0 && (
        <div className={sp.section} style={sectionHighlight(highlights?.skills, printMode)}>
          <SectionHeader>Skills</SectionHeader>
          <p style={{ fontSize: `${fontSize}px`, color: "#374151", lineHeight: 1.4 }}>
            {data.skills.slice(0, 16).join(" • ")}
          </p>
        </div>
      )}

      {/* Education */}
      {data.education && data.education.length > 0 && (
        <div className={sp.section} style={sectionHighlight(highlights?.education, printMode)}>
          <SectionHeader>Education</SectionHeader>
          {data.education.map((edu, i) => (
            <div key={i} className="flex justify-between items-baseline" style={{ marginBottom: "4px" }}>
              <div>
                <span style={{ fontSize: `${fontSize}px`, fontWeight: 600 }}>{edu.degree}</span>
                <span style={{ fontSize: `${fontSize - 0.5}px`, color: "#4B5563" }}>
                  {" "}· {edu.institution}
                </span>
              </div>
              <span style={{ fontSize: `${fontSize - 1}px`, color: "#6B7280" }}>{edu.year}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        fontSize: "10px",
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.1em",
        color: "#1F2937",
        borderBottom: "1px solid #E5E7EB",
        paddingBottom: "2px",
        marginBottom: "6px",
      }}
    >
      {children}
    </h2>
  );
}
