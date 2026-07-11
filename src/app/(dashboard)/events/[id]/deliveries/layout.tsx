import { ReactNode } from "react";

import { requireModuleEnabled } from "@/lib/features/moduleGuards";

export default function EventDeliveriesModuleLayout({ children }: { children: ReactNode }) {
  requireModuleEnabled("deliveries");
  return children;
}
