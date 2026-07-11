import { ReactNode } from "react";

import { requireModuleEnabled } from "@/lib/features/moduleGuards";

export default function CrmModuleLayout({ children }: { children: ReactNode }) {
  requireModuleEnabled("crm");
  return children;
}
