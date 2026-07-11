import { ReactNode } from "react";
import { notFound } from "next/navigation";

import { isModuleEnabled } from "@/lib/features/modules";

export default function PublicFeedbackModuleLayout({ children }: { children: ReactNode }) {
  if (!isModuleEnabled("feedback")) notFound();
  return children;
}
