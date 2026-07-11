import { ReactNode } from "react";
import { notFound } from "next/navigation";

import { isModuleEnabled } from "@/lib/features/modules";

export default function PublicPollModuleLayout({ children }: { children: ReactNode }) {
  if (!isModuleEnabled("polling")) notFound();
  return children;
}
