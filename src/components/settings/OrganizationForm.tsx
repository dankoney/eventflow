"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AttendeeTheme, PublicPageTemplate, ZoomSessionKind } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { ImageUrlField } from "@/components/events/public-event-editor/ImageUrlField";
import { BrandColorTripletField } from "@/components/settings/BrandColorTripletField";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  updateOrganizationEventBrandingDefaults,
  updateOrganizationMarketingSettings,
  updateOrganizationNewEventDefaults,
  updateOrganizationWorkspace
} from "@/lib/actions/settings.actions";

const optionalBrandingAssetUrl = z
  .string()
  .max(2048)
  .optional()
  .nullable()
  .transform((s) => {
    const t = typeof s === "string" ? s.trim() : "";
    return t.length ? t : null;
  })
  .superRefine((val, ctx) => {
    if (!val) return;
    if (val.startsWith("/uploads/")) {
      if (val.includes("..") || val.length > 500) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid uploaded asset path" });
      }
      return;
    }
    try {
      const u = new URL(val);
      if (u.protocol !== "https:") {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "URL must use https://" });
      }
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Enter a valid https URL or pick from media" });
    }
  });

const workspaceSchema = z.object({
  name: z.string().min(1, "Name is required").max(120)
});

const newEventDefaultsSchema = z.object({
  defaultEventVirtualCapacity: z.coerce.number().int().min(1).max(50000),
  defaultZoomSessionKind: z.nativeEnum(ZoomSessionKind)
});

const brandingSchema = z.object({
  defaultEventBannerImageUrl: optionalBrandingAssetUrl,
  defaultEventBrandLogoUrl: optionalBrandingAssetUrl,
  defaultEventAttendeeTheme: z.nativeEnum(AttendeeTheme),
  defaultEventPublicPageTemplate: z.nativeEnum(PublicPageTemplate),
  defaultEventBrandPrimaryColor: z
    .string()
    .max(32)
    .optional()
    .nullable()
    .transform((s) => {
      const t = typeof s === "string" ? s.trim() : "";
      return t.length ? t : null;
    })
    .superRefine((val, ctx) => {
      if (!val) return;
      if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(val)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Use hex like #0f172a or leave empty" });
      }
    }),
  defaultEventBrandSecondaryColor: z
    .string()
    .max(32)
    .optional()
    .nullable()
    .transform((s) => {
      const t = typeof s === "string" ? s.trim() : "";
      return t.length ? t : null;
    })
    .superRefine((val, ctx) => {
      if (!val) return;
      if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(val)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Use hex like #0f172a or leave empty" });
      }
    }),
  defaultEventBrandTertiaryColor: z
    .string()
    .max(32)
    .optional()
    .nullable()
    .transform((s) => {
      const t = typeof s === "string" ? s.trim() : "";
      return t.length ? t : null;
    })
    .superRefine((val, ctx) => {
      if (!val) return;
      if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(val)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Use hex like #0f172a or leave empty" });
      }
    })
});

type WorkspaceValues = z.infer<typeof workspaceSchema>;
type NewEventDefaultsValues = z.infer<typeof newEventDefaultsSchema>;
type BrandingValues = z.infer<typeof brandingSchema>;

export type OrganizationFormDefaults = {
  defaultEventBannerImageUrl: string | null;
  defaultEventBrandLogoUrl: string | null;
  defaultEventAttendeeTheme: AttendeeTheme;
  defaultEventPublicPageTemplate: PublicPageTemplate;
  defaultEventBrandPrimaryColor: string | null;
  defaultEventBrandSecondaryColor: string | null;
  defaultEventBrandTertiaryColor: string | null;
  defaultEventVirtualCapacity: number;
  defaultZoomSessionKind: ZoomSessionKind;
};

type OrganizationWorkspaceFormProps = {
  defaultName: string;
  slug: string;
};

export function OrganizationWorkspaceForm({ defaultName, slug }: OrganizationWorkspaceFormProps) {
  const router = useRouter();
  const form = useForm<WorkspaceValues>({
    resolver: zodResolver(workspaceSchema),
    defaultValues: { name: defaultName }
  });

  async function onSubmit(values: WorkspaceValues) {
    const res = await updateOrganizationWorkspace(values);
    if (!res.success) {
      form.setError("root", { message: res.error ?? "Failed to save" });
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-slate-900">Workspace</h3>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Organization name</label>
          <Input {...form.register("name")} autoComplete="organization" />
          {form.formState.errors.name ? (
            <p className="mt-1 text-sm text-red-600">{form.formState.errors.name.message}</p>
          ) : null}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Workspace slug</label>
          <Input value={slug} readOnly className="bg-slate-50 font-mono text-sm text-slate-600" />
          <p className="mt-1 text-xs text-slate-500">Used internally; changing it may arrive in a later release.</p>
        </div>
        <p className="text-xs text-slate-500">
          Logo and brand colors are configured under <span className="font-medium">Default event branding</span> below.
        </p>
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

type OrganizationNewEventDefaultsFormProps = {
  eventDefaults: OrganizationFormDefaults;
};

export function OrganizationNewEventDefaultsForm({ eventDefaults }: OrganizationNewEventDefaultsFormProps) {
  const router = useRouter();
  const form = useForm<NewEventDefaultsValues>({
    resolver: zodResolver(newEventDefaultsSchema),
    defaultValues: {
      defaultEventVirtualCapacity: eventDefaults.defaultEventVirtualCapacity,
      defaultZoomSessionKind: eventDefaults.defaultZoomSessionKind
    }
  });

  async function onSubmit(values: NewEventDefaultsValues) {
    const res = await updateOrganizationNewEventDefaults(values);
    if (!res.success) {
      form.setError("root", { message: res.error ?? "Failed to save" });
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Default virtual seat count</label>
        <Input type="number" min={1} max={50000} {...form.register("defaultEventVirtualCapacity", { valueAsNumber: true })} />
        <p className="mt-1 text-xs text-slate-500">Used when virtual or hybrid is enabled on a new event.</p>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Default Zoom session type</label>
        <select className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" {...form.register("defaultZoomSessionKind")}>
          <option value={ZoomSessionKind.MEETING}>Meeting</option>
          <option value={ZoomSessionKind.WEBINAR}>Webinar</option>
        </select>
      </div>

      {form.formState.errors.root ? (
        <p className="text-sm text-red-600">{form.formState.errors.root.message}</p>
      ) : null}
      <Button type="submit" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? "Saving…" : "Save new event defaults"}
      </Button>
    </form>
  );
}

type OrganizationEventBrandingFormProps = {
  eventDefaults: OrganizationFormDefaults;
};

export function OrganizationEventBrandingForm({ eventDefaults }: OrganizationEventBrandingFormProps) {
  const router = useRouter();
  const form = useForm<BrandingValues>({
    resolver: zodResolver(brandingSchema),
    defaultValues: {
      defaultEventBannerImageUrl: eventDefaults.defaultEventBannerImageUrl ?? "",
      defaultEventBrandLogoUrl: eventDefaults.defaultEventBrandLogoUrl ?? "",
      defaultEventAttendeeTheme: eventDefaults.defaultEventAttendeeTheme,
      defaultEventPublicPageTemplate: eventDefaults.defaultEventPublicPageTemplate,
      defaultEventBrandPrimaryColor: eventDefaults.defaultEventBrandPrimaryColor ?? "",
      defaultEventBrandSecondaryColor: eventDefaults.defaultEventBrandSecondaryColor ?? "",
      defaultEventBrandTertiaryColor: eventDefaults.defaultEventBrandTertiaryColor ?? ""
    }
  });

  const bannerUrl = form.watch("defaultEventBannerImageUrl") ?? "";
  const logoUrl = form.watch("defaultEventBrandLogoUrl") ?? "";
  const primaryColor = form.watch("defaultEventBrandPrimaryColor") ?? "";
  const secondaryColor = form.watch("defaultEventBrandSecondaryColor") ?? "";
  const tertiaryColor = form.watch("defaultEventBrandTertiaryColor") ?? "";

  async function onSubmit(values: BrandingValues) {
    const res = await updateOrganizationEventBrandingDefaults(values);
    if (!res.success) {
      form.setError("root", { message: res.error ?? "Failed to save" });
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
      <ImageUrlField
        label="Default logo"
        hint="Used on new events, staff notices, and registration pages. Pick from media, upload, or paste an https link."
        value={logoUrl}
        onChange={(url) => form.setValue("defaultEventBrandLogoUrl", url, { shouldValidate: true, shouldDirty: true })}
      />
      {form.formState.errors.defaultEventBrandLogoUrl ? (
        <p className="text-sm text-red-600">{form.formState.errors.defaultEventBrandLogoUrl.message as string}</p>
      ) : null}

      <ImageUrlField
        label="Default banner image (21:9)"
        hint="Hero image for new public registration pages."
        value={bannerUrl}
        onChange={(url) =>
          form.setValue("defaultEventBannerImageUrl", url, { shouldValidate: true, shouldDirty: true })
        }
      />
      {form.formState.errors.defaultEventBannerImageUrl ? (
        <p className="text-sm text-red-600">{form.formState.errors.defaultEventBannerImageUrl.message as string}</p>
      ) : null}

      <div>
        <p className="mb-2 text-sm font-medium text-slate-700">Brand colors</p>
        <p className="mb-3 text-xs text-slate-500">
          Primary, secondary, and tertiary colors for staff notices, registration pages, and new events. Leave empty to
          use system defaults.
        </p>
        <BrandColorTripletField
          primary={primaryColor}
          secondary={secondaryColor}
          tertiary={tertiaryColor}
          onPrimaryChange={(v) =>
            form.setValue("defaultEventBrandPrimaryColor", v, { shouldValidate: true, shouldDirty: true })
          }
          onSecondaryChange={(v) =>
            form.setValue("defaultEventBrandSecondaryColor", v, { shouldValidate: true, shouldDirty: true })
          }
          onTertiaryChange={(v) =>
            form.setValue("defaultEventBrandTertiaryColor", v, { shouldValidate: true, shouldDirty: true })
          }
        />
        {form.formState.errors.defaultEventBrandPrimaryColor ? (
          <p className="mt-1 text-sm text-red-600">{form.formState.errors.defaultEventBrandPrimaryColor.message as string}</p>
        ) : null}
        {form.formState.errors.defaultEventBrandSecondaryColor ? (
          <p className="mt-1 text-sm text-red-600">
            {form.formState.errors.defaultEventBrandSecondaryColor.message as string}
          </p>
        ) : null}
        {form.formState.errors.defaultEventBrandTertiaryColor ? (
          <p className="mt-1 text-sm text-red-600">{form.formState.errors.defaultEventBrandTertiaryColor.message as string}</p>
        ) : null}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Default public page template</label>
        <select
          className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
          {...form.register("defaultEventPublicPageTemplate")}
        >
          <option value={PublicPageTemplate.SUMMIT}>Template 1 — Summit</option>
          <option value={PublicPageTemplate.NIGHT_EDITION}>Template 2 — Night Edition</option>
          <option value={PublicPageTemplate.TECH_NEXUS}>Template 3 — TechNexus</option>
        </select>
        <p className="mt-1 text-xs text-slate-500">Pre-selected when creating a new event. Summit supports light, dark, or system color mode.</p>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Default attendee theme</label>
        <select className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" {...form.register("defaultEventAttendeeTheme")}>
          <option value={AttendeeTheme.LIGHT}>Light</option>
          <option value={AttendeeTheme.DARK}>Dark</option>
          <option value={AttendeeTheme.SYSTEM}>System</option>
        </select>
        <p className="mt-1 text-xs text-slate-500">Applies to Template 1 (Summit) only.</p>
      </div>

      {form.formState.errors.root ? (
        <p className="text-sm text-red-600">{form.formState.errors.root.message}</p>
      ) : null}
      <Button type="submit" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? "Saving…" : "Save branding defaults"}
      </Button>
    </form>
  );
}

const marketingSchema = z.object({
  marketingEmailEnabled: z.boolean(),
  marketingConsentCopy: z.string().max(2000).optional(),
  marketingPrivacyPolicyUrl: z.string().max(2048).optional()
});

type MarketingValues = z.infer<typeof marketingSchema>;

export type OrganizationMarketingDefaults = {
  marketingEmailEnabled: boolean;
  marketingConsentCopy: string | null;
  marketingPrivacyPolicyUrl: string | null;
  orgName: string;
};

export function OrganizationMarketingForm({ defaults }: { defaults: OrganizationMarketingDefaults }) {
  const router = useRouter();
  const form = useForm<MarketingValues>({
    resolver: zodResolver(marketingSchema),
    defaultValues: {
      marketingEmailEnabled: defaults.marketingEmailEnabled,
      marketingConsentCopy: defaults.marketingConsentCopy ?? "",
      marketingPrivacyPolicyUrl: defaults.marketingPrivacyPolicyUrl ?? ""
    }
  });

  const enabled = form.watch("marketingEmailEnabled");

  async function onSubmit(values: MarketingValues) {
    const res = await updateOrganizationMarketingSettings({
      marketingEmailEnabled: values.marketingEmailEnabled,
      marketingConsentCopy: values.marketingConsentCopy?.trim() || null,
      marketingPrivacyPolicyUrl: values.marketingPrivacyPolicyUrl?.trim() || null
    });
    if (!res.success) {
      form.setError("root", { message: res.error ?? "Failed to save" });
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4"
          {...form.register("marketingEmailEnabled")}
        />
        <span>
          <span className="block font-semibold text-slate-900">Collect marketing opt-in on RSVP & registration</span>
          <span className="mt-1 block text-slate-600">
            Shows an unchecked checkbox on public registration and invite RSVP pages (not internal-staff programs).
            Guests are never subscribed without ticking the box.
          </span>
        </span>
      </label>

      {enabled ? (
        <>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Consent checkbox label</label>
            <textarea
              {...form.register("marketingConsentCopy")}
              rows={3}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder={`Email me about future events and updates from {orgName}.`}
            />
            <p className="mt-1 text-xs text-slate-500">
              Use <code className="rounded bg-slate-100 px-1">{"{orgName}"}</code> for {defaults.orgName}. Leave blank
              for the default copy.
            </p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Privacy policy URL (https)</label>
            <Input
              {...form.register("marketingPrivacyPolicyUrl")}
              type="url"
              placeholder="https://example.com/privacy"
            />
          </div>
        </>
      ) : null}

      {form.formState.errors.root ? (
        <p className="text-sm text-red-600">{form.formState.errors.root.message}</p>
      ) : null}
      <Button type="submit" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? "Saving…" : "Save marketing settings"}
      </Button>
    </form>
  );
}
