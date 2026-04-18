import { ReactNode } from "react";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { DashboardChrome } from "@/components/dashboard/DashboardChrome";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session?.user?.orgId) {
    redirect("/login");
  }

  return (
    <DashboardChrome email={session.user.email} role={session.user.role}>
      {children}
    </DashboardChrome>
  );
}
