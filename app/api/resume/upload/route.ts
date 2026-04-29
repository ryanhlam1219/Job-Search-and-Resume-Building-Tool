import { NextRequest, NextResponse } from "next/server";

// POST /api/resume/upload — parse PDF and return raw text
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "Only PDF files are accepted" }, { status: 400 });
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large (max 5MB)" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfParseModule = await import("pdf-parse") as any;
    const pdfParse = pdfParseModule.default || pdfParseModule;
    const result = await pdfParse(buffer);

    const rawText = fixGlyphEncoding(result.text)
      .replace(/[^\S\n]+/g, " ")           // collapse all horizontal whitespace (incl. unicode spaces) to single space
      .replace(/([a-z])([A-Z])/g, "$1 $2") // fix concatenated camelCase words like "managingSchedule"
      .replace(/•(?=\S)/g, "• ")           // ensure space after bullet • when directly followed by text
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    return NextResponse.json({ rawText, pageCount: result.numpages });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to parse PDF";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * Some PDFs embed fonts with non-standard glyph mappings that pdf-parse cannot
 * decode. A common symptom is the letter 'f' (or ligatures like 'fi', 'fl')
 * rendering as '0'. This function fixes those substitutions by detecting '0'
 * characters that appear in letter-only context (i.e. surrounded by or adjacent
 * to alphabetic characters) where a digit makes no sense.
 */
function fixGlyphEncoding(text: string): string {
  return (
    text
      // "Con0identiality" → "Confidentiality"  (0 flanked by letters on both sides)
      .replace(/(?<=[a-zA-Z])0(?=[a-zA-Z])/g, "f")
      // " 0ile" / "\n0irst" → " file" / "\nfirst"  (0 at word-start before letters, after whitespace)
      .replace(/(?<=\s)0(?=[a-zA-Z]{2})/g, "f")
      // "staf0" / "quali0" → "staff" / "qualify"  (0 at word-end after letters, before whitespace/punct)
      .replace(/(?<=[a-zA-Z]{2})0(?=[\s,.:;!?)(\-]|$)/gm, "f")
  );
}
