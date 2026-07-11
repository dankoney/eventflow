"use client";

import { Role } from "@prisma/client";
import { Menu, X } from "lucide-react";
import { ReactNode, useState } from "react";

import { DashboardNav } from "@/components/dashboard/DashboardNav";
import { LogoutButton } from "@/components/dashboard/LogoutButton";
import type { EnabledModules } from "@/lib/features/modules";
import { cn } from "@/lib/utils";

type DashboardChromeProps = {
  email: string | null | undefined;
  role: Role;
  isPlatformOwner?: boolean;
  enabledModules: EnabledModules;
  children: ReactNode;
};

export function DashboardChrome({
  email,
  role,
  isPlatformOwner = false,
  enabledModules,
  children
}: DashboardChromeProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-slate-50">
      <button
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((o) => !o)}
        className="fixed left-4 top-4 z-[60] flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 bg-white shadow-sm md:hidden"
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/40 transition-opacity md:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        aria-hidden={!open}
        onClick={() => setOpen(false)}
      />

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex h-dvh w-64 max-w-[85vw] flex-col border-r border-slate-200 bg-white transition-transform md:sticky md:top-0 md:h-screen md:max-w-none md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        <div className="border-b border-slate-100 px-4 py-5 pt-16 md:pt-5">
          <p className="text-lg font-semibold text-slate-900">Eventflow</p>
          <p className="mt-1 truncate text-xs text-slate-500">{email}</p>
          <p className="mt-0.5 text-xs font-medium uppercase tracking-wide text-slate-400">
            {role.replace(/_/g, " ")}
            {isPlatformOwner ? " · Platform owner" : ""}
          </p>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <DashboardNav
            role={role}
            isPlatformOwner={isPlatformOwner}
            enabledModules={enabledModules}
            onNavigate={() => {
              setOpen(false);
            }}
          />
        </div>
        <div className="border-t border-slate-100 p-3">
          <LogoutButton />
        </div>
      </aside>

      <main className="min-w-0 flex-1 p-4 pt-16 md:w-0 md:flex-1 md:p-6 md:pt-8 lg:p-8">{children}</main>
    </div>
  );
}
