"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { createLocation, deleteLocation, updateLocation } from "@/lib/actions/location.actions";
import type { LocationListItem } from "@/lib/db/locations";

const formSchema = z.object({
  name: z.string().min(1).max(120),
  address: z.string().min(1).max(500),
  capacity: z.coerce.number().int().min(1)
});

type FormValues = z.infer<typeof formSchema>;

type LocationsPanelProps = {
  locations: LocationListItem[];
};

export function LocationsPanel({ locations }: LocationsPanelProps) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);

  const createForm = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", address: "", capacity: 100 }
  });

  const editForm = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", address: "", capacity: 100 }
  });

  function startEdit(loc: LocationListItem) {
    setEditingId(loc.id);
    editForm.reset({
      name: loc.name,
      address: loc.address,
      capacity: loc.capacity
    });
  }

  async function onCreate(values: FormValues) {
    const res = await createLocation(values);
    if (!res.success) {
      createForm.setError("root", { message: res.error ?? "Failed" });
      return;
    }
    createForm.reset({ name: "", address: "", capacity: 100 });
    router.refresh();
  }

  async function onUpdate(values: FormValues) {
    if (!editingId) return;
    const res = await updateLocation({ id: editingId, ...values });
    if (!res.success) {
      editForm.setError("root", { message: res.error ?? "Failed" });
      return;
    }
    setEditingId(null);
    router.refresh();
  }

  async function onDelete(id: string) {
    if (!confirm("Delete this venue? Events that still use it cannot be deleted until you reassign them.")) return;
    const res = await deleteLocation({ id });
    if (!res.success) {
      alert(res.error ?? "Could not delete");
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">Add venue</h3>
        <form onSubmit={createForm.handleSubmit(onCreate)} className="mt-4 max-w-xl space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Name</label>
            <Input {...createForm.register("name")} placeholder="Main auditorium" />
            {createForm.formState.errors.name ? (
              <p className="mt-1 text-xs text-red-600">{createForm.formState.errors.name.message}</p>
            ) : null}
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Address</label>
            <Input {...createForm.register("address")} placeholder="Street, city" />
            {createForm.formState.errors.address ? (
              <p className="mt-1 text-xs text-red-600">{createForm.formState.errors.address.message}</p>
            ) : null}
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Venue capacity</label>
            <Input type="number" min={1} {...createForm.register("capacity")} />
          </div>
          {createForm.formState.errors.root ? (
            <p className="text-sm text-red-600">{createForm.formState.errors.root.message}</p>
          ) : null}
          <Button type="submit" className="text-xs px-3 py-1.5" disabled={createForm.formState.isSubmitting}>
            {createForm.formState.isSubmitting ? "Adding…" : "Add venue"}
          </Button>
        </form>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-900">Saved venues</h3>
        {locations.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">No venues yet. Add one above.</p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
            {locations.map((loc) => (
              <li key={loc.id} className="p-4">
                {editingId === loc.id ? (
                  <form onSubmit={editForm.handleSubmit(onUpdate)} className="space-y-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-700">Name</label>
                      <Input {...editForm.register("name")} />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-700">Address</label>
                      <Input {...editForm.register("address")} />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-700">Capacity</label>
                      <Input type="number" min={1} {...editForm.register("capacity")} />
                    </div>
                    {editForm.formState.errors.root ? (
                      <p className="text-sm text-red-600">{editForm.formState.errors.root.message}</p>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      <Button type="submit" className="text-xs px-3 py-1.5" disabled={editForm.formState.isSubmitting}>
                        Save
                      </Button>
                      <Button type="button" variant="secondary" className="text-xs px-3 py-1.5" onClick={() => setEditingId(null)}>
                        Cancel
                      </Button>
                    </div>
                  </form>
                ) : (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-medium text-slate-900">{loc.name}</p>
                      <p className="text-sm text-slate-600">{loc.address}</p>
                      <p className="mt-1 text-xs text-slate-500">Capacity: {loc.capacity}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" variant="secondary" className="text-xs px-3 py-1.5" onClick={() => startEdit(loc)}>
                        Edit
                      </Button>
                      <Button type="button" variant="danger" className="text-xs px-3 py-1.5" onClick={() => onDelete(loc.id)}>
                        Delete
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
