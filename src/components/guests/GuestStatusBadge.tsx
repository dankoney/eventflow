import { GuestStatus } from "@/types";

import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

const styles: Record<GuestStatus, string> = {
  INVITED: "bg-zinc-100 text-zinc-800 ring-1 ring-zinc-200/80",
  REGISTERED: "bg-indigo-50 text-indigo-900 ring-1 ring-indigo-100",
  ACCEPTED: "bg-sky-50 text-sky-900 ring-1 ring-sky-100",
  CHECKED_IN: "bg-zinc-100 text-zinc-900 ring-1 ring-zinc-200",
  JOINED: "bg-violet-50 text-violet-900 ring-1 ring-violet-100",
  NO_SHOW: "bg-red-50 text-red-900 ring-1 ring-red-100",
  DECLINED: "bg-amber-50 text-amber-900 ring-1 ring-amber-100"
};

type GuestStatusBadgeProps = {
  status: GuestStatus;
};

export function GuestStatusBadge({ status }: GuestStatusBadgeProps) {
  return <Badge className={cn(styles[status] ?? "bg-slate-100")}>{status.replace(/_/g, " ")}</Badge>;
}
