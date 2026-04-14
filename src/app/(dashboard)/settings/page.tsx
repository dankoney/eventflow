import { Role } from "@prisma/client";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { OrganizationForm } from "@/components/settings/OrganizationForm";
import { ProfileForm } from "@/components/settings/ProfileForm";
import { Card } from "@/components/ui/Card";
import { prisma } from "@/lib/prisma";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.orgId) redirect("/login");

  const [user, org] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, email: true }
    }),
    prisma.organization.findUnique({
      where: { id: session.user.orgId },
      select: { name: true, slug: true }
    })
  ]);

  if (!user || !org) redirect("/login");

  const isAdmin = session.user.role === Role.ADMIN;

  return (
    <section className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Settings</h1>
        <p className="mt-1 text-sm text-slate-600">
          Your profile and {isAdmin ? "organization" : "workspace"} details.
        </p>
      </div>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-slate-900">Profile</h2>
        <p className="mt-1 text-sm text-slate-600">Name shown in the app header and on guest assignments.</p>
        <div className="mt-6 max-w-md">
          <ProfileForm email={user.email ?? ""} defaultName={user.name} />
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-slate-900">Organization</h2>
        <p className="mt-1 text-sm text-slate-600">
          {isAdmin ? "Company name appears on public pages and emails where relevant." : "Only admins can edit the company name."}
        </p>
        <div className="mt-6 max-w-md">
          {isAdmin ? (
            <OrganizationForm defaultName={org.name} slug={org.slug} />
          ) : (
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-slate-500">Organization</dt>
                <dd className="font-medium text-slate-900">{org.name}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Slug</dt>
                <dd className="font-mono text-slate-800">{org.slug}</dd>
              </div>
            </dl>
          )}
        </div>
      </Card>
    </section>
  );
}
