"use client";

import { useEffect } from "react";

export function HeartbeatProvider() {
  useEffect(() => {
    const send = () =>
      fetch("/api/heartbeat", { method: "POST" }).catch(() => {});
    send(); // immediate on mount
    const id = setInterval(send, 30_000);
    return () => clearInterval(id);
  }, []);
  return null;
}
