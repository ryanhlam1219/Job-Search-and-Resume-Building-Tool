"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ResumePreview } from "@/frontend/components/resume/ResumePreview";
import type { ResumeData } from "@/backend/lib/types";

function PrintContent() {
  const searchParams = useSearchParams();
  const dataParam = searchParams.get("data");
  const token = searchParams.get("token");
  const [resumeData, setResumeData] = useState<ResumeData | null>(null);
  const [loading, setLoading] = useState(Boolean(token && !dataParam));

  useEffect(() => {
    let cancelled = false;

    if (dataParam) {
      try {
        const parsed = JSON.parse(decodeURIComponent(dataParam)) as ResumeData;
        setResumeData(parsed);
      } catch {
        setResumeData(null);
      }
      setLoading(false);
      return;
    }

    if (!token) {
      setResumeData(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    fetch(`/api/export-pdf/${token}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load resume data");
        const data = await res.json();
        if (!cancelled) {
          setResumeData(data.resumeData as ResumeData);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setResumeData(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [dataParam, token]);

  if (loading) {
    return <div>Loading resume...</div>;
  }

  if (!resumeData) {
    return <div style={{ color: "red" }}>Invalid resume data</div>;
  }

  return (
    <ResumePreview
      data={resumeData}
      printMode={true}
    />
  );
}

export default function PrintPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <PrintContent />
    </Suspense>
  );
}
