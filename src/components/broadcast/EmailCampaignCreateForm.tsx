"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { BroadcastSegmentBuilder } from "@/components/broadcast/BroadcastSegmentBuilder";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { createCampaignAction } from "@/lib/actions/emailCampaign.actions";
import type { BroadcastEventOption, BroadcastSegmentFilterOptions } from "@/lib/db/emailBroadcast";
import type { EmailSegmentDefinition } from "@/lib/email/segmentDefinition";

type TemplateOption = { id: string; name: string; isPrebuilt: boolean };

type EmailCampaignCreateFormProps = {
  orgId: string;
  events: BroadcastEventOption[];
  initialFilterOptions: BroadcastSegmentFilterOptions;
  templates: TemplateOption[];
};

export function EmailCampaignCreateForm({
  orgId,
  events,
  initialFilterOptions,
  templates
}: EmailCampaignCreateFormProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [segmentDefinition, setSegmentDefinition] = useState<EmailSegmentDefinition | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!segmentDefinition) {
      setError("Build a segment below and wait for the recipient preview to load.");
      return;
    }
    setSaving(true);
    setError(null);
    const res = await createCampaignAction({
      name,
      subject,
      templateId,
      segmentDefinition
    });
    setSaving(false);
    if (!res.success || !res.data) {
      setError(res.success ? "Could not create campaign." : (res.error ?? "Could not create campaign."));
      return;
    }
    router.push(`/broadcasts/campaigns/${res.data.id}`);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div className="grid gap-4 rounded-xl border border-zinc-200 bg-white p-5 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-600">Campaign name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-600">Email subject</label>
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} required />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-zinc-600">Template</label>
          <select
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            required
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
                {t.isPrebuilt ? " (starter)" : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-zinc-900">Audience segment</h2>
        <p className="mb-4 text-xs text-zinc-500">
          Recipients are resolved again at send time. Only subscribed contacts receive the
          broadcast.
        </p>
        <BroadcastSegmentBuilder
          orgId={orgId}
          events={events}
          initialFilterOptions={initialFilterOptions}
          onDefinitionChange={setSegmentDefinition}
        />
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <Button type="submit" disabled={saving}>
        {saving ? "Creating…" : "Create draft campaign"}
      </Button>
    </form>
  );
}
