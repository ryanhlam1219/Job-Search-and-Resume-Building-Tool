import { writeFileSync } from "fs";

export async function POST() {
  try {
    writeFileSync("/tmp/jobassist_heartbeat", Date.now().toString());
  } catch {
    // non-fatal — watcher will just see a stale/missing file
  }
  return new Response(null, { status: 204 });
}
