import { redirect } from "next/navigation";

import { Role } from "@prisma/client";

import { auth } from "@/auth";
import { MediaLibraryHub } from "@/components/media/MediaLibraryHub";
import { WorkspacePageShell } from "@/components/ui/WorkspacePageShell";

export default async function MediaLibraryPage() {
  const session = await auth();
  if (!session?.user?.orgId) redirect("/login");
  if (session.user.role !== Role.ADMIN && session.user.role !== Role.MARKETING) {
    redirect("/dashboard");
  }

  return (
    <WorkspacePageShell
      className="max-w-6xl"
      kicker="Assets"
      title="Media library"
      description="Upload once, reuse everywhere — images, videos, and documents for your workspace."
    >
      <MediaLibraryHub />
    </WorkspacePageShell>
  );
}
