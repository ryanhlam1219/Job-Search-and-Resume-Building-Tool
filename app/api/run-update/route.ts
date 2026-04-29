import { NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";

export async function POST() {
  const cwd = process.cwd();
  const script = path.join(cwd, "update.sh");
  const startScript = path.join(cwd, "start.sh");

  // Spawn detached so the child process survives the server shutting down.
  // The sequence: run update.sh (pull, npm install, migrate), then restart.
  const child = spawn(
    "bash",
    ["-c", `"${script}" && "${startScript}" stop && "${startScript}"`],
    {
      detached: true,
      stdio: "ignore",
      cwd,
    }
  );
  child.unref();

  return NextResponse.json({ started: true });
}
