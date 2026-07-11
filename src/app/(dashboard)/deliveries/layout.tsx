import { ReactNode } from "react";

import { requireModuleEnabled } from "@/lib/features/moduleGuards";

export default function DeliveriesModuleLayout({ children }: { children: ReactNode }) {
  requireModuleEnabled("deliveries");
  return children;
}
