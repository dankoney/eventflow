import { ReactNode } from "react";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { DashboardNav } from "@/components/dashboard/DashboardNav";
import { LogoutButton } from "@/components/dashboard/LogoutButton";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session?.user?.orgId) {
    redirect("/login");
  }

  const role = session.user.role;

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="flex w-64 flex-col border-r border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-5">
          <p className="text-lg font-semibold text-slate-900">Eventflow</p>
          <p className="mt-1 truncate text-xs text-slate-500">{session.user.email}</p>
          <p className="mt-0.5 text-xs font-medium uppercase tracking-wide text-slate-400">
            {role.replace(/_/g, " ")}
          </p>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <DashboardNav role={role} />
        </div>
        <div className="border-t border-slate-100 p-3">
          <LogoutButton />
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-6 lg:p-8">{children}</main>
    </div>
  );
}
