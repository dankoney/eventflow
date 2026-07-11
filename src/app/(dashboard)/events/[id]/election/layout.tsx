import { ReactNode } from "react";

import { requireModuleEnabled } from "@/lib/features/moduleGuards";

export default function EventElectionModuleLayout({ children }: { children: ReactNode }) {
  requireModuleEnabled("polling");
  return children;
}
