"use client";

import { OrgPlan } from "@prisma/client";
import { Check, Copy, Loader2, MailCheck, Sparkles } from "lucide-react";
import Link from "next/link";
import { useState, useTransition, type FormEvent } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { WorkspaceNotice } from "@/components/ui/WorkspaceNotice";
import { provisionOrganization } from "@/lib/actions/platform.actions";
import { slugifyWorkspaceName } from "@/lib/utils";

type Success = {
  orgId: string;
  adminEmail: string;
  activationUrl: string;
  emailSent: boolean;
  emailError?: string;
};

export function ProvisionOrgForm() {
  const [organizationName, setOrganizationName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [plan, setPlan] = useState<OrgPlan>(OrgPlan.FREE);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<Success | null>(null);
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  function maybeAutoSlug(value: string) {
    if (slugTouched) return;
    setSlug(slugifyWorkspaceName(value));
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const res = await provisionOrganization({
        organizationName: organizationName.trim(),
        slug: slug.trim() || undefined,
        adminName: adminName.trim(),
        adminEmail: adminEmail.trim(),
        plan
      });
      if (!res.success || !res.data) {
        setError(res.error ?? "Could not provision the workspace.");
        return;
      }
      setSuccess({
        orgId: res.data.orgId,
        adminEmail: adminEmail.trim(),
        activationUrl: res.data.activationUrl,
        emailSent: res.data.emailSent,
        ...(res.data.emailError ? { emailError: res.data.emailError } : {})
      });
      setOrganizationName("");
      setSlug("");
      setSlugTouched(false);
      setAdminName("");
      setAdminEmail("");
      setPlan(OrgPlan.FREE);
    });
  }

  async function copyLink() {
    if (!success) return;
    try {
      await navigator.clipboard.writeText(success.activationUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <form
        onSubmit={handleSubmit}
        className="lg:col-span-2 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6"
        noValidate
      >
        <h2 className="text-base font-semibold text-zinc-900">Workspace details</h2>
        <p className="mt-1 text-sm text-zinc-600">
          The admin will receive a brand-aligned activation email; the link is valid for 7 days
          and works once.
        </p>
        <div className="mt-5 space-y-4">
          <Field label="Organization name">
            <Input
              value={organizationName}
              onChange={(e) => {
                setOrganizationName(e.target.value);
                maybeAutoSlug(e.target.value);
              }}
              placeholder="Acme Corp"
              maxLength={120}
              autoComplete="organization"
              required
            />
          </Field>
          <Field
            label="Workspace slug"
            hint="Lowercase letters, numbers, hyphens. Auto-filled from the name until you edit it."
          >
            <Input
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value);
              }}
              placeholder="acme-corp"
              maxLength={60}
              autoComplete="off"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Admin name">
              <Input
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                placeholder="Jane Doe"
                maxLength={120}
                autoComplete="name"
                required
              />
            </Field>
            <Field label="Admin email">
              <Input
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                placeholder="jane@acme.com"
                maxLength={254}
                autoComplete="email"
                required
              />
            </Field>
          </div>
          <Field label="Plan" hint="Selectable now; feature gating is not yet enforced.">
            <select
              value={plan}
              onChange={(e) => setPlan(e.target.value as OrgPlan)}
              className="w-full rounded-md border border-slate-400/70 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-400/25"
            >
              <option value={OrgPlan.FREE}>Free</option>
              <option value={OrgPlan.PRO}>Pro</option>
              <option value={OrgPlan.ENTERPRISE}>Enterprise</option>
            </select>
          </Field>
        </div>
        <div className="mt-6 flex items-center gap-3">
          <Button type="submit" disabled={pending} className="inline-flex items-center gap-2">
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="h-4 w-4" aria-hidden />
            )}
            {pending ? "Provisioning…" : "Provision workspace"}
          </Button>
          <Link href="/superadmin" className="text-xs font-semibold text-zinc-600 hover:underline">
            Cancel
          </Link>
        </div>
        {error ? (
          <div className="mt-4">
            <WorkspaceNotice variant="error">{error}</WorkspaceNotice>
          </div>
        ) : null}
      </form>

      <aside className="lg:col-span-1">
        {success ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <MailCheck className="h-4 w-4 text-emerald-700" aria-hidden />
              <h3 className="text-base font-semibold text-emerald-900">Workspace provisioned</h3>
            </div>
            <p className="mt-2 text-sm text-emerald-900">
              {success.emailSent ? (
                <>
                  Activation email sent to{" "}
                  <strong className="break-all">{success.adminEmail}</strong>.
                </>
              ) : (
                <>
                  Activation email did <strong>not</strong> reach{" "}
                  <strong className="break-all">{success.adminEmail}</strong>. Send the link
                  below to the admin via another channel.
                </>
              )}
            </p>
            <div className="mt-4 rounded-lg border border-emerald-200 bg-white p-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                  Activation link
                </p>
                <button
                  type="button"
                  onClick={copyLink}
                  className="inline-flex items-center gap-1 rounded p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
                  aria-label="Copy activation link"
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-emerald-700" aria-hidden />
                  ) : (
                    <Copy className="h-3.5 w-3.5" aria-hidden />
                  )}
                </button>
              </div>
              <p className="mt-2 break-all font-mono text-[11px] leading-relaxed text-zinc-700">
                {success.activationUrl}
              </p>
            </div>
            {success.emailError ? (
              <p className="mt-3 text-[11px] text-amber-800">{success.emailError}</p>
            ) : null}
            <Link
              href="/superadmin"
              className="mt-4 inline-block text-xs font-semibold text-emerald-800 hover:underline"
            >
              Back to workspaces →
            </Link>
          </div>
        ) : (
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50/40 p-5 shadow-sm">
            <h3 className="text-base font-semibold text-zinc-900">What gets created</h3>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-zinc-700">
              <li>
                A new <strong>Organization</strong> (slug must be unique).
              </li>
              <li>
                A first <strong>ADMIN</strong> user — sign-in via the standard email-OTP flow.
              </li>
              <li>A default location row (editable later).</li>
              <li>A sample DRAFT event seeded on activation, so the dashboard isn&apos;t empty.</li>
              <li>An activation email with a 7-day single-use link.</li>
            </ul>
            <p className="mt-4 rounded-md border border-zinc-200 bg-white p-3 text-[11px] text-zinc-500">
              Provisioning is rate-limited to 10 workspaces per hour per platform owner.
            </p>
          </div>
        )}
      </aside>
    </div>
  );
}

function Field({
  label,
  hint,
  children
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{label}</span>
      <div className="mt-1">{children}</div>
      {hint ? <span className="mt-1 block text-[11px] text-zinc-500">{hint}</span> : null}
    </label>
  );
}
