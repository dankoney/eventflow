import { ReactNode } from "react";

import { requireModuleEnabled } from "@/lib/features/moduleGuards";

export default function AnalyticsModuleLayout({ children }: { children: ReactNode }) {
  requireModuleEnabled("analytics");
  return children;
}
