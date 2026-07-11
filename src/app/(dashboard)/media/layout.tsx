import { ReactNode } from "react";

import { requireModuleEnabled } from "@/lib/features/moduleGuards";

export default function MediaModuleLayout({ children }: { children: ReactNode }) {
  requireModuleEnabled("media");
  return children;
}
