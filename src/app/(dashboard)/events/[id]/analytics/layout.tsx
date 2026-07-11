import { ReactNode } from "react";

import { requireModuleEnabled } from "@/lib/features/moduleGuards";

export default function EventAnalyticsModuleLayout({ children }: { children: ReactNode }) {
  requireModuleEnabled("analytics");
  return children;
}
