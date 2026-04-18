"use client";

import { useEffect } from "react";

export function CheckinPwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    const path = window.location.pathname;
    if (!path.includes("/checkin")) return;
    void navigator.serviceWorker.register("/checkin-sw.js").catch(() => {});
  }, []);
  return null;
}
