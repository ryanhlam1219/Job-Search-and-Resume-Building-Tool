import { NextRequest, NextResponse } from "next/server";
import type { ResumeData } from "@/backend/lib/types";
import { createPdfExportToken, deletePdfExportToken } from "@/backend/lib/pdf-export-store";

// POST /api/export-pdf
export async function POST(req: NextRequest) {
  try {
    const { resumeData }: { resumeData: ResumeData } = await req.json();

    if (!resumeData) {
      return NextResponse.json({ error: "resumeData required" }, { status: 400 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    // Dynamic import Puppeteer
    const puppeteer = await import("puppeteer");
    const browser = await puppeteer.default.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 816, height: 1056 });

    const token = createPdfExportToken(resumeData);

    await page.goto(`${baseUrl}/resume/print?token=${token}`, {
      waitUntil: "networkidle0",
      timeout: 30000,
    });

    // Wait for resume to render
    await page.waitForSelector("[data-resume-ready]", { timeout: 10000 });

    // Remove page chrome and global UI before printing
    await page.evaluate(() => {
      document.querySelector("nav")?.remove();
      const liveRegions = document.querySelectorAll("[aria-live]");
      liveRegions.forEach((node) => {
        if (node.parentElement === document.body) node.remove();
      });
      const main = document.querySelector("main");
      if (main) main.style.paddingTop = "0";
      document.body.style.margin = "0";
      document.body.style.background = "#ffffff";
    });

    const pdf = await page.pdf({
      width: "8.5in",
      height: "11in",
      printBackground: true,
      margin: { top: 0, bottom: 0, left: 0, right: 0 },
    });

    await browser.close();
    deletePdfExportToken(token);

    const name = (resumeData.name || "resume").replace(/\s+/g, "_").toLowerCase();

    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${name}_resume.pdf"`,
        "Content-Length": String(pdf.length),
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
