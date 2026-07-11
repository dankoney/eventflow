"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { WorkspaceNotice } from "@/components/ui/WorkspaceNotice";
import { updateOrgContactDirectoryMeta } from "@/lib/actions/orgContact.actions";

const metaSchema = z.object({
  categoryLabelsCsv: z.string().max(4000),
  internalStaffFooterContact: z.string().max(240).optional().nullable()
});

type CrmOrgDefaultsFormProps = {
  defaultCategoryLabelsCsv: string;
  defaultFooterContact: string | null;
};

export function CrmOrgDefaultsForm({ defaultCategoryLabelsCsv, defaultFooterContact }: CrmOrgDefaultsFormProps) {
  const router = useRouter();
  const [actionError, setActionError] = useState<string | null>(null);

  const metaForm = useForm<z.infer<typeof metaSchema>>({
    resolver: zodResolver(metaSchema),
    defaultValues: {
      categoryLabelsCsv: defaultCategoryLabelsCsv,
      internalStaffFooterContact: defaultFooterContact ?? ""
    }
  });

  async function onSaveMeta(values: z.infer<typeof metaSchema>) {
    setActionError(null);
    const res = await updateOrgContactDirectoryMeta(values);
    if (!res.success) {
      setActionError(res.error ?? "Could not save settings");
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-4">
        <h3 className="text-sm font-semibold text-slate-900">CRM &amp; internal programs</h3>
        <p className="mt-1 text-xs text-slate-600">
          Manage people, stakeholders, and segments on the dedicated{" "}
          <Link href="/crm" className="font-medium text-sky-800 underline underline-offset-2">
            CRM hub
          </Link>
          . Use this card only for <strong>preset category labels</strong> (wizard filters) and the{" "}
          <strong>internal check-in footer line</strong>.
        </p>
        {actionError ? (
          <WorkspaceNotice variant="error" className="mt-3" onDismiss={() => setActionError(null)}>
            {actionError}
          </WorkspaceNotice>
        ) : null}
        <form className="mt-4 space-y-3" onSubmit={metaForm.handleSubmit((v) => void onSaveMeta(v))}>
          <div>
            <label className="text-xs font-medium text-slate-700">Category labels (comma or newline)</label>
            <textarea
              className="mt-1 w-full min-h-[72px] rounded-md border border-slate-300 px-2 py-2 text-sm"
              {...metaForm.register("categoryLabelsCsv")}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-700">Internal check-in footer contact line</label>
            <Input
              className="mt-1"
              placeholder='e.g. "Partner success team"'
              {...metaForm.register("internalStaffFooterContact")}
            />
          </div>
          <Button type="submit" variant="secondary" className="px-3 py-1.5 text-xs">
            Save CRM defaults
          </Button>
        </form>
      </div>
    </div>
  );
}
