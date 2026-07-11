import { ReactNode } from "react";

import { requireModuleEnabled } from "@/lib/features/moduleGuards";

export default function EventFeedbackModuleLayout({ children }: { children: ReactNode }) {
  requireModuleEnabled("feedback");
  return children;
}
