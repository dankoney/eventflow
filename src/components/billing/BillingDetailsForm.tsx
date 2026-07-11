"use client";

import { useState, useTransition } from "react";

import { updateOrgBillingDetailsAction } from "@/lib/actions/billing.actions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export type BillingDetailsFormValues = {
  billingLegalName: string;
  billingAddressLine1: string;
  billingAddressLine2: string;
  billingCity: string;
  billingRegion: string;
  billingPostalCode: string;
  billingCountry: string;
};

type BillingDetailsFormProps = {
  initial: BillingDetailsFormValues;
};

export function BillingDetailsForm({ initial }: BillingDetailsFormProps) {
  const [values, setValues] = useState(initial);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function setField<K extends keyof BillingDetailsFormValues>(key: K, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const res = await updateOrgBillingDetailsAction(values);
      if (!res.success) {
        setError(res.error ?? "Could not save.");
        return;
      }
      setMessage("Billing details saved. They will appear on future payment receipts.");
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label htmlFor="billingLegalName" className="mb-1 block text-sm font-medium text-zinc-700">
          Legal / company name
        </label>
        <Input
          id="billingLegalName"
          value={values.billingLegalName}
          onChange={(e) => setField("billingLegalName", e.target.value)}
          placeholder="e.g. John Doe Company Ltd"
          maxLength={200}
        />
        <p className="mt-1 text-xs text-zinc-500">
          Leave blank to use your workspace name on receipts.
        </p>
      </div>

      <div>
        <label htmlFor="billingAddressLine1" className="mb-1 block text-sm font-medium text-zinc-700">
          Address line 1
        </label>
        <Input
          id="billingAddressLine1"
          value={values.billingAddressLine1}
          onChange={(e) => setField("billingAddressLine1", e.target.value)}
          placeholder="Street / building"
          maxLength={200}
        />
      </div>

      <div>
        <label htmlFor="billingAddressLine2" className="mb-1 block text-sm font-medium text-zinc-700">
          Address line 2 <span className="font-normal text-zinc-400">(optional)</span>
        </label>
        <Input
          id="billingAddressLine2"
          value={values.billingAddressLine2}
          onChange={(e) => setField("billingAddressLine2", e.target.value)}
          placeholder="Suite, floor, landmark"
          maxLength={200}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="billingCity" className="mb-1 block text-sm font-medium text-zinc-700">
            City / town
          </label>
          <Input
            id="billingCity"
            value={values.billingCity}
            onChange={(e) => setField("billingCity", e.target.value)}
            maxLength={100}
          />
        </div>
        <div>
          <label htmlFor="billingRegion" className="mb-1 block text-sm font-medium text-zinc-700">
            Region / state
          </label>
          <Input
            id="billingRegion"
            value={values.billingRegion}
            onChange={(e) => setField("billingRegion", e.target.value)}
            maxLength={100}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="billingPostalCode" className="mb-1 block text-sm font-medium text-zinc-700">
            Postal / ZIP <span className="font-normal text-zinc-400">(optional)</span>
          </label>
          <Input
            id="billingPostalCode"
            value={values.billingPostalCode}
            onChange={(e) => setField("billingPostalCode", e.target.value)}
            maxLength={20}
          />
        </div>
        <div>
          <label htmlFor="billingCountry" className="mb-1 block text-sm font-medium text-zinc-700">
            Country
          </label>
          <Input
            id="billingCountry"
            value={values.billingCountry}
            onChange={(e) => setField("billingCountry", e.target.value)}
            placeholder="Ghana"
            maxLength={100}
          />
        </div>
      </div>

      {error ? (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {message}
        </p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save billing details"}
      </Button>
    </form>
  );
}
