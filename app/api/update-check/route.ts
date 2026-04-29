import { NextResponse } from "next/server";
import { execSync } from "child_process";

export async function GET() {
  try {
    const localCommit = execSync("git rev-parse HEAD", {
      cwd: process.cwd(),
      encoding: "utf8",
    }).trim();

    const res = await fetch(
      "https://api.github.com/repos/ryanhlam1219/Job-Search-and-Resume-Building-Tool/commits/main",
      {
        headers: { Accept: "application/vnd.github.v3+json" },
        next: { revalidate: 300 }, // cache for 5 min server-side
      }
    );

    if (!res.ok) {
      return NextResponse.json({ upToDate: true });
    }

    const data = await res.json();
    const remoteCommit: string = data.sha;

    return NextResponse.json({
      upToDate: localCommit === remoteCommit,
      localCommit: localCommit.slice(0, 7),
      remoteCommit: remoteCommit.slice(0, 7),
    });
  } catch {
    // If git isn't available or network fails, silently suppress
    return NextResponse.json({ upToDate: true });
  }
}
