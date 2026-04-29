import type { ResumeData } from "@/backend/lib/types";

interface StoredResumePayload {
  resumeData: ResumeData;
  expiresAt: number;
}

const PDF_EXPORT_TTL_MS = 2 * 60 * 1000;

const globalStore = globalThis as typeof globalThis & {
  __pdfExportStore?: Map<string, StoredResumePayload>;
};

const store = globalStore.__pdfExportStore ?? new Map<string, StoredResumePayload>();
globalStore.__pdfExportStore = store;

function purgeExpiredEntries() {
  const now = Date.now();
  for (const [token, payload] of store.entries()) {
    if (payload.expiresAt <= now) {
      store.delete(token);
    }
  }
}

export function createPdfExportToken(resumeData: ResumeData) {
  purgeExpiredEntries();
  const token = crypto.randomUUID();
  store.set(token, {
    resumeData,
    expiresAt: Date.now() + PDF_EXPORT_TTL_MS,
  });
  return token;
}

export function getPdfExportPayload(token: string) {
  purgeExpiredEntries();
  return store.get(token)?.resumeData ?? null;
}

export function deletePdfExportToken(token: string) {
  store.delete(token);
}