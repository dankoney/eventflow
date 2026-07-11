import { CrmContactKind, Role } from "@prisma/client";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { CrmHub } from "@/components/crm/CrmHub";
import { WorkspacePageShell } from "@/components/ui/WorkspacePageShell";
import {
  countCrmHubContacts,
  listCrmHubContactsPage,
  listEventsForCrmPicker,
  listOrgContactGroupsForOrg,
  type CrmHubSortField
} from "@/lib/db/crm";

type CrmPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default async function CrmPage({ searchParams }: CrmPageProps) {
  const session = await auth();
  if (!session?.user?.orgId) redirect("/login");
  if (session.user.role !== Role.ADMIN && session.user.role !== Role.MARKETING) {
    redirect("/dashboard");
  }

  const perPageRaw = searchParams?.perPage;
  const perPageStr = Array.isArray(perPageRaw) ? perPageRaw[0] : perPageRaw;
  const perPageNum = parseInt(perPageStr ?? "25", 10) || 25;
  const pageSize = ([10, 25, 50, 100] as const).includes(perPageNum as 10 | 25 | 50 | 100) ? perPageNum : 25;

  const pageRaw = searchParams?.page;
  const pageStr = Array.isArray(pageRaw) ? pageRaw[0] : pageRaw;
  const page = Math.max(1, parseInt(pageStr ?? "1", 10) || 1);

  const qRaw = searchParams?.q;
  const q = (Array.isArray(qRaw) ? qRaw[0] : qRaw)?.trim() ?? "";

  const kindRaw = searchParams?.kind;
  const kindStr = Array.isArray(kindRaw) ? kindRaw[0] : kindRaw;
  const crmKind =
    kindStr && (Object.values(CrmContactKind) as string[]).includes(kindStr) ? (kindStr as CrmContactKind) : undefined;

  const groupRaw = searchParams?.group;
  const groupId = (Array.isArray(groupRaw) ? groupRaw[0] : groupRaw)?.trim() || undefined;

  const sortRaw = searchParams?.sort;
  const sortStr = Array.isArray(sortRaw) ? sortRaw[0] : sortRaw;
  const allowedSort: CrmHubSortField[] = [
    "name",
    "email",
    "company",
    "crmKind",
    "lifecycleStage",
    "source",
    "updatedAt"
  ];
  const sortBy =
    sortStr && allowedSort.includes(sortStr as CrmHubSortField)
      ? (sortStr as CrmHubSortField)
      : undefined;

  const dirRaw = searchParams?.dir;
  const dirStr = Array.isArray(dirRaw) ? dirRaw[0] : dirRaw;
  const sortDir: "asc" | "desc" | undefined =
    dirStr === "asc" || dirStr === "desc" ? dirStr : undefined;

  const filters = { q, crmKind, groupId, sortBy, sortDir };
  const skip = (page - 1) * pageSize;

  const [total, rows, groups, crmEvents] = await Promise.all([
    countCrmHubContacts(session.user.orgId, filters),
    listCrmHubContactsPage(session.user.orgId, filters, skip, pageSize),
    listOrgContactGroupsForOrg(session.user.orgId),
    listEventsForCrmPicker(session.user.orgId)
  ]);

  return (
    <WorkspacePageShell
      className="w-full min-w-0 max-w-7xl"
      clipContent={false}
      kicker="Workspace"
      title="CRM"
      description="Organization-wide relationships: attendees, stakeholders, sponsors, and custom segments. Sync from guest lists, import spreadsheets, and keep one canonical profile per email."
    >
      <CrmHub
        rows={rows}
        total={total}
        page={page}
        pageSize={pageSize}
        groups={groups}
        eventOptions={crmEvents.map((e) => ({
          id: e.id,
          name: e.name,
          date: e.date.toISOString()
        }))}
        filters={{
          q,
          crmKind: crmKind ?? "",
          groupId: groupId ?? "",
          sortBy: sortBy ?? "",
          sortDir: sortDir ?? ""
        }}
        isAdmin={session.user.role === Role.ADMIN}
        canDeleteContacts={session.user.role === Role.ADMIN || session.user.role === Role.MARKETING}
      />
    </WorkspacePageShell>
  );
}
