import { GuestStatus } from "@/types";

import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

const styles: Record<GuestStatus, string> = {
  INVITED: "bg-slate-100 text-slate-800",
  REGISTERED: "bg-blue-100 text-blue-900",
  CHECKED_IN: "bg-emerald-100 text-emerald-900",
  JOINED: "bg-violet-100 text-violet-900",
  NO_SHOW: "bg-red-100 text-red-900"
};

type GuestStatusBadgeProps = {
  status: GuestStatus;
};

export function GuestStatusBadge({ status }: GuestStatusBadgeProps) {
  return <Badge className={cn(styles[status] ?? "bg-slate-100")}>{status.replace(/_/g, " ")}</Badge>;
}
