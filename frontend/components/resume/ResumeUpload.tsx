"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, FileText, Loader2, CheckCircle, AlertCircle, FolderOpen } from "lucide-react";
import { cn } from "@/backend/lib/utils";
import type { ResumeData } from "@/backend/lib/types";

interface ResumeUploadProps {
  onParsed: (data: ResumeData) => void;
}

type UploadState = "idle" | "uploading" | "parsing" | "done" | "error";

export function ResumeUpload({ onParsed }: ResumeUploadProps) {
  const [state, setState] = useState<UploadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const processFile = useCallback(async (file: File) => {
    if (file.type !== "application/pdf") {
      setError("Only PDF files are accepted");
      setState("error");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("File too large (max 5MB)");
      setState("error");
      return;
    }

    setFileName(file.name);
    setError(null);
    setState("uploading");

    try {
      // Step 1: Extract text from PDF
      const formData = new FormData();
      formData.append("file", file);
      const uploadRes = await fetch("/api/resume/upload", { method: "POST", body: formData });
      if (!uploadRes.ok) {
        const err = await uploadRes.json();
        throw new Error(err.error || "Upload failed");
      }
      const { rawText } = await uploadRes.json();

      setState("parsing");

      // Step 2: AI parse into structured JSON
      const parseForm = new FormData();
      parseForm.append("rawText", rawText);
      const parseRes = await fetch("/api/resume", { method: "POST", body: parseForm });
      if (!parseRes.ok) {
        const err = await parseRes.json();
        throw new Error(err.error || "Parsing failed");
      }
      const resume = await parseRes.json();
      onParsed(resume.data as ResumeData);
      setState("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setState("error");
    }
  }, [onParsed]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (files) => files[0] && processFile(files[0]),
    accept: { "application/pdf": [".pdf"] },
    maxFiles: 1,
    disabled: state === "uploading" || state === "parsing",
  });

  return (
    <div className="flex flex-col gap-4">

      <div
        {...getRootProps()}
        className={cn(
          "relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-200",
          isDragActive
            ? "border-violet-500 bg-violet-500/10"
            : "border-white/20 hover:border-violet-500/50 hover:bg-white/5",
          (state === "uploading" || state === "parsing") && "pointer-events-none opacity-75"
        )}
      >
      <input {...getInputProps()} />

      <div className="flex flex-col items-center gap-3">
        {state === "idle" && (
          <>
            <div className="w-14 h-14 rounded-full bg-violet-500/10 border border-violet-500/30 flex items-center justify-center">
              <Upload className="text-violet-400" size={24} />
            </div>
            <div>
              <p className="text-white font-semibold">Drop your resume here</p>
              <p className="text-gray-400 text-sm mt-1">PDF only · Max 5MB</p>
            </div>
            <span className="text-xs text-violet-400 bg-violet-500/10 px-3 py-1 rounded-full border border-violet-500/20">
              Click or drag to upload
            </span>
          </>
        )}

        {(state === "uploading" || state === "parsing") && (
          <>
            <div className="w-14 h-14 rounded-full bg-violet-500/10 border border-violet-500/30 flex items-center justify-center">
              <Loader2 className="text-violet-400 animate-spin" size={24} />
            </div>
            <p className="text-white font-semibold">
              {state === "uploading" ? "Reading PDF…" : "AI parsing resume…"}
            </p>
            <p className="text-gray-400 text-sm">{fileName}</p>
          </>
        )}

        {state === "done" && (
          <>
            <div className="w-14 h-14 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center">
              <CheckCircle className="text-green-400" size={24} />
            </div>
            <p className="text-white font-semibold">Resume parsed successfully!</p>
            <p className="text-gray-400 text-sm">{fileName}</p>
            <span className="text-xs text-gray-400">Click to upload a different resume</span>
          </>
        )}

        {state === "error" && (
          <>
            <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
              <AlertCircle className="text-red-400" size={24} />
            </div>
            <p className="text-white font-semibold">Upload failed</p>
            <p className="text-red-400 text-sm">{error}</p>
            <span className="text-xs text-gray-400">Click to try again</span>
          </>
        )}
      </div>
    </div>

      {/* Explicit browse button — label+input guarantees native file picker, no JS .click() needed */}
      {state !== "uploading" && state !== "parsing" && (
        <label className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-violet-500/40 text-gray-300 hover:text-white rounded-xl text-sm font-medium transition-colors cursor-pointer">
          <input
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) processFile(file);
              e.target.value = "";
            }}
          />
          <FolderOpen size={16} className="text-violet-400" />
          Browse Files
        </label>
      )}
    </div>
  );
}
