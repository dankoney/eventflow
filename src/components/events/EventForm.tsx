"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { EventType } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";
import { createEvent } from "@/lib/actions/event.actions";

const schema = z
  .object({
    name: z.string().min(2, "Name is required"),
    description: z.string().optional(),
    date: z.string().min(1, "Start date is required"),
    endDate: z.string().optional(),
    location: z.string().min(2, "Location is required"),
    capacity: z.coerce.number().int().min(1),
    enableVirtual: z.boolean(),
    virtualCapacity: z.coerce.number().int().min(0),
    type: z.nativeEnum(EventType)
  })
  .superRefine((data, ctx) => {
    if (data.enableVirtual && data.virtualCapacity < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Set virtual capacity to at least 1 or turn off virtual.",
        path: ["virtualCapacity"]
      });
    }
  });

export type EventFormValues = z.infer<typeof schema>;

export function EventForm() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<EventFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      description: "",
      date: "",
      endDate: "",
      location: "",
      capacity: 50,
      enableVirtual: false,
      virtualCapacity: 50,
      type: EventType.IN_PERSON
    }
  });

  const enableVirtual = form.watch("enableVirtual");

  async function onSubmit(values: EventFormValues) {
    setFormError(null);
    const virtualCapacity = values.enableVirtual ? values.virtualCapacity : 0;

    const result = await createEvent({
      name: values.name,
      description: values.description || undefined,
      date: new Date(values.date),
      endDate: values.endDate ? new Date(values.endDate) : undefined,
      location: values.location,
      capacity: values.capacity,
      virtualCapacity,
      type: values.type
    });

    if (!result.success || !result.data) {
      setFormError(result.error ?? "Could not create event");
      return;
    }

    router.push(`/events/${result.data.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-2xl space-y-5">
      <div>
        <label htmlFor="name" className="mb-1 block text-sm font-medium text-slate-700">
          Name
        </label>
        <Input id="name" {...form.register("name")} />
        {form.formState.errors.name && (
          <p className="mt-1 text-sm text-red-600">{form.formState.errors.name.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="description" className="mb-1 block text-sm font-medium text-slate-700">
          Description
        </label>
        <textarea
          id="description"
          rows={3}
          className={cn(
            "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-slate-300 focus:ring-2"
          )}
          {...form.register("description")}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="date" className="mb-1 block text-sm font-medium text-slate-700">
            Start
          </label>
          <Input id="date" type="datetime-local" {...form.register("date")} />
          {form.formState.errors.date && (
            <p className="mt-1 text-sm text-red-600">{form.formState.errors.date.message}</p>
          )}
        </div>
        <div>
          <label htmlFor="endDate" className="mb-1 block text-sm font-medium text-slate-700">
            End <span className="font-normal text-slate-500">(optional)</span>
          </label>
          <Input id="endDate" type="datetime-local" {...form.register("endDate")} />
        </div>
      </div>

      <div>
        <label htmlFor="location" className="mb-1 block text-sm font-medium text-slate-700">
          Location
        </label>
        <Input id="location" {...form.register("location")} />
        {form.formState.errors.location && (
          <p className="mt-1 text-sm text-red-600">{form.formState.errors.location.message}</p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="capacity" className="mb-1 block text-sm font-medium text-slate-700">
            In-person capacity
          </label>
          <Input id="capacity" type="number" min={1} {...form.register("capacity")} />
        </div>
        <div>
          <span className="mb-1 block text-sm font-medium text-slate-700">Event type</span>
          <select
            id="type"
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
            {...form.register("type")}
          >
            <option value={EventType.IN_PERSON}>In person</option>
            <option value={EventType.VIRTUAL}>Virtual</option>
            <option value={EventType.HYBRID}>Hybrid</option>
          </select>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
          <input type="checkbox" className="rounded border-slate-300" {...form.register("enableVirtual")} />
          Enable virtual attendance (Zoom webinar)
        </label>
        {enableVirtual ? (
          <div className="mt-3">
            <label htmlFor="virtualCapacity" className="mb-1 block text-sm text-slate-700">
              Virtual capacity
            </label>
            <Input
              id="virtualCapacity"
              type="number"
              min={1}
              {...form.register("virtualCapacity", { valueAsNumber: true })}
            />
            {form.formState.errors.virtualCapacity && (
              <p className="mt-1 text-sm text-red-600">{form.formState.errors.virtualCapacity.message}</p>
            )}
            <p className="mt-2 text-xs text-slate-600">
              A Zoom webinar is created automatically when virtual capacity is greater than zero.
            </p>
          </div>
        ) : null}
      </div>

      {formError ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {formError}
        </p>
      ) : null}

      <div className="flex gap-3">
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Creating…" : "Create event"}
        </Button>
        <Button type="button" variant="secondary" onClick={() => router.push("/events")}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
