"use client";

import { useEffect } from "react";

export function HeartbeatProvider() {
  useEffect(() => {
    const send = () =>
      fetch("/api/heartbeat", { method: "POST", keepalive: true }).catch(() => {});

    send(); // immediate on mount
    const id = setInterval(send, 30_000);

    // Send immediately when the tab becomes visible again — prevents false
    // idle-timeouts caused by browsers throttling setInterval when hidden.
    const onVisible = () => {
      if (document.visibilityState === "visible") send();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  return null;
}
