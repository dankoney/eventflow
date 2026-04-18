"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { updateOrganizationName } from "@/lib/actions/settings.actions";

const schema = z.object({
  name: z.string().min(1, "Name is required").max(120),
  logo: z.string().max(2000).optional()
});

type Values = z.infer<typeof schema>;

type OrganizationFormProps = {
  defaultName: string;
  defaultLogo?: string | null;
  slug: string;
};

export function OrganizationForm({ defaultName, defaultLogo, slug }: OrganizationFormProps) {
  const router = useRouter();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: defaultName, logo: defaultLogo ?? "" }
  });

  async function onSubmit(values: Values) {
    const res = await updateOrganizationName({ name: values.name, logo: values.logo });
    if (!res.success) {
      form.setError("root", { message: res.error ?? "Failed to save" });
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Organization name</label>
        <Input {...form.register("name")} autoComplete="organization" />
        {form.formState.errors.name ? (
          <p className="mt-1 text-sm text-red-600">{form.formState.errors.name.message}</p>
        ) : null}
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Logo URL</label>
        <Input {...form.register("logo")} type="url" placeholder="https://…" autoComplete="off" />
        <p className="mt-1 text-xs text-slate-500">Optional. Use a public https image URL.</p>
        {form.formState.errors.logo ? (
          <p className="mt-1 text-sm text-red-600">{form.formState.errors.logo.message}</p>
        ) : null}
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Workspace slug</label>
        <Input value={slug} readOnly className="bg-slate-50 font-mono text-sm text-slate-600" />
        <p className="mt-1 text-xs text-slate-500">Used internally; changing it may arrive in a later release.</p>
      </div>
      {form.formState.errors.root ? (
        <p className="text-sm text-red-600">{form.formState.errors.root.message}</p>
      ) : null}
      <Button type="submit" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? "Saving…" : "Save organization"}
      </Button>
    </form>
  );
}
