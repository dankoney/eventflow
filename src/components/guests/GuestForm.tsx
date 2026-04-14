"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AttendMode, Role, Tier } from "@prisma/client";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";
import { addGuest } from "@/lib/actions/guest.actions";

const schema = z
  .object({
    name: z.string().min(2),
    email: z.string().email(),
    phone: z.string().optional(),
    company: z.string().optional(),
    jobTitle: z.string().optional(),
    tier: z.nativeEnum(Tier),
    mode: z.nativeEnum(AttendMode),
    dietary: z.string().optional(),
    repId: z.string().optional()
  })
  .superRefine((data, ctx) => {
    if (data.mode === AttendMode.IN_PERSON && !data.dietary?.trim()) {
      /* dietary optional per product */
    }
  });

type FormValues = z.infer<typeof schema>;

type SalesRepOption = { id: string; name: string | null; email: string };

type GuestFormProps = {
  eventId: string;
  salesReps: SalesRepOption[];
  role: Role;
  currentUserId: string;
  onSuccess: () => void;
  onCancel: () => void;
};

export function GuestForm({ eventId, salesReps, role, currentUserId, onSuccess, onCancel }: GuestFormProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      company: "",
      jobTitle: "",
      tier: Tier.C,
      mode: AttendMode.IN_PERSON,
      dietary: "",
      repId: role === "SALES_REP" ? currentUserId : ""
    }
  });

  const mode = form.watch("mode");

  async function onSubmit(values: FormValues) {
    const repId =
      role === "SALES_REP" ? currentUserId : values.repId?.trim() ? values.repId.trim() : undefined;

    const res = await addGuest({
      eventId,
      name: values.name,
      email: values.email,
      phone: values.phone || undefined,
      company: values.company || undefined,
      jobTitle: values.jobTitle || undefined,
      tier: values.tier,
      mode: values.mode,
      dietary: mode === AttendMode.IN_PERSON ? values.dietary?.trim() || undefined : undefined,
      repId: repId ?? null
    });

    if (!res.success) {
      form.setError("root", { message: res.error ?? "Failed" });
      return;
    }
    onSuccess();
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm font-medium text-slate-700">Full name</label>
          <Input {...form.register("name")} />
          {form.formState.errors.name && (
            <p className="mt-1 text-sm text-red-600">{form.formState.errors.name.message}</p>
          )}
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm font-medium text-slate-700">Work email</label>
          <Input type="email" {...form.register("email")} />
          {form.formState.errors.email && (
            <p className="mt-1 text-sm text-red-600">{form.formState.errors.email.message}</p>
          )}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Phone</label>
          <Input {...form.register("phone")} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Company</label>
          <Input {...form.register("company")} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Job title</label>
          <Input {...form.register("jobTitle")} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Tier</label>
          <select
            {...form.register("tier")}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
          >
            <option value={Tier.A}>A</option>
            <option value={Tier.B}>B</option>
            <option value={Tier.C}>C</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Attendance mode</label>
          <select
            {...form.register("mode")}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
          >
            <option value={AttendMode.IN_PERSON}>In person</option>
            <option value={AttendMode.VIRTUAL}>Virtual</option>
          </select>
        </div>
        {mode === AttendMode.IN_PERSON ? (
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">Dietary</label>
            <Input placeholder="Allergies / preferences" {...form.register("dietary")} />
          </div>
        ) : null}
        {(role === "ADMIN" || role === "MARKETING") && salesReps.length > 0 ? (
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">Assigned rep</label>
            <select
              {...form.register("repId")}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
            >
              <option value="">— Unassigned —</option>
              {salesReps.map((r) => (
                <option key={r.id} value={r.id}>
                  {(r.name ?? r.email) + ` (${r.email})`}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        {role === "SALES_REP" ? (
          <p className="sm:col-span-2 text-sm text-slate-600">You will be assigned as the rep for this guest.</p>
        ) : null}
      </div>

      {form.formState.errors.root && (
        <p className="text-sm text-red-600">{form.formState.errors.root.message}</p>
      )}

      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Saving…" : "Add guest"}
        </Button>
      </div>
    </form>
  );
}
