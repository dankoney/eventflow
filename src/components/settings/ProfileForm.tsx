"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { updateMyProfile } from "@/lib/actions/settings.actions";

const schema = z.object({
  name: z.string().max(120, "Max 120 characters")
});

type Values = z.infer<typeof schema>;

type ProfileFormProps = {
  email: string;
  defaultName: string | null;
};

export function ProfileForm({ email, defaultName }: ProfileFormProps) {
  const router = useRouter();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: defaultName ?? "" }
  });

  async function onSubmit(values: Values) {
    const res = await updateMyProfile({ name: values.name });
    if (!res.success) {
      form.setError("root", { message: res.error ?? "Failed to save" });
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Display name</label>
        <Input {...form.register("name")} autoComplete="name" />
        {form.formState.errors.name ? (
          <p className="mt-1 text-sm text-red-600">{form.formState.errors.name.message}</p>
        ) : null}
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
        <Input value={email} readOnly className="bg-slate-50 text-slate-600" />
        <p className="mt-1 text-xs text-slate-500">Email is managed by your administrator.</p>
      </div>
      {form.formState.errors.root ? (
        <p className="text-sm text-red-600">{form.formState.errors.root.message}</p>
      ) : null}
      <Button type="submit" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? "Saving…" : "Save profile"}
      </Button>
    </form>
  );
}
