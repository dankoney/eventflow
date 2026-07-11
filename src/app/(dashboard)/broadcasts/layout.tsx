import { ReactNode } from "react";

import { requireModuleEnabled } from "@/lib/features/moduleGuards";

export default function BroadcastsModuleLayout({ children }: { children: ReactNode }) {
  requireModuleEnabled("broadcast");
  return children;
}
