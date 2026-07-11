"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  testGoogleMapsIntegration,
  testMnotifyIntegration,
  testResendIntegration,
  testWhatsappIntegration,
  testZoomIntegration,
  type IntegrationHealth
} from "@/lib/actions/integration.actions";
import {
  updateOrganizationGoogleMapsFields,
  updateOrganizationMnotifyFields,
  updateOrganizationResendFields,
  updateOrganizationWhatsappFields,
  updateOrganizationZoomOauthFields
} from "@/lib/actions/settings.actions";
import { cn } from "@/lib/utils";

const INTEGRATIONS = ["zoom", "whatsapp", "resend", "mnotify", "google_maps"] as const;
type IntegrationId = (typeof INTEGRATIONS)[number];

const INTEGRATION_LABELS: Record<IntegrationId, string> = {
  zoom: "Zoom",
  whatsapp: "WhatsApp",
  resend: "Resend",
  mnotify: "mNotify SMS",
  google_maps: "Google Maps"
};

function integrationHref(tab: IntegrationId) {
  return `/dashboard/settings?tab=integrations&integration=${tab}`;
}

function HealthBadge({ status }: { status: IntegrationHealth | null }) {
  const label = status === "healthy" ? "Healthy" : "Action required";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        status === "healthy" ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-900"
      )}
    >
      {label}
    </span>
  );
}

const zoomOauthSchema = z.object({
  zoomClientId: z.string().max(500).optional(),
  zoomClientSecret: z.string().max(500).optional(),
  zoomAccountId: z.string().max(500).optional()
});

type ZoomOauthFormValues = z.infer<typeof zoomOauthSchema>;

type ZoomPanelProps = {
  defaultZoomClientId: string | null;
  defaultZoomAccountId: string | null;
  hasStoredZoomSecret: boolean;
};

function ZoomPanel({ defaultZoomClientId, defaultZoomAccountId, hasStoredZoomSecret }: ZoomPanelProps) {
  const router = useRouter();
  const [health, setHealth] = useState<IntegrationHealth | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  const form = useForm<ZoomOauthFormValues>({
    resolver: zodResolver(zoomOauthSchema),
    defaultValues: {
      zoomClientId: defaultZoomClientId ?? "",
      zoomClientSecret: "",
      zoomAccountId: defaultZoomAccountId ?? ""
    }
  });

  async function onTest() {
    setTesting(true);
    setDetail(null);
    const res = await testZoomIntegration();
    setTesting(false);
    if (!res.success || !res.data) {
      setHealth("action_required");
      setDetail(res.error ?? "Test failed");
      return;
    }
    setHealth(res.data.status);
    setDetail(res.data.detail ?? null);
  }

  async function onSubmit(values: ZoomOauthFormValues) {
    const res = await updateOrganizationZoomOauthFields({
      zoomClientId: values.zoomClientId?.trim() || null,
      zoomClientSecret: values.zoomClientSecret?.trim() || null,
      zoomAccountId: values.zoomAccountId?.trim() || null
    });
    if (!res.success) {
      form.setError("root", { message: res.error ?? "Failed to save" });
      return;
    }
    form.reset({
      zoomClientId: values.zoomClientId?.trim() ?? "",
      zoomAccountId: values.zoomAccountId?.trim() ?? "",
      zoomClientSecret: ""
    });
    router.refresh();
  }

  async function onClear() {
    const res = await updateOrganizationZoomOauthFields({
      zoomClientId: null,
      zoomClientSecret: null,
      zoomAccountId: null
    });
    if (!res.success) {
      form.setError("root", { message: res.error ?? "Failed to remove credentials" });
      return;
    }
    form.reset({ zoomClientId: "", zoomClientSecret: "", zoomAccountId: "" });
    setHealth(null);
    setDetail(null);
    router.refresh();
  }

  const hasStored =
    Boolean(defaultZoomClientId?.trim()) ||
    Boolean(defaultZoomAccountId?.trim()) ||
    hasStoredZoomSecret;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Zoom</h3>
          <p className="mt-1 text-xs text-slate-600">
            Server-to-Server OAuth for creating Zoom meetings and webinars. Hosts start sessions from the event page
            using the Zoom app link. Empty fields fall back to server environment variables.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <HealthBadge status={health} />
          <Button type="button" variant="secondary" disabled={testing} onClick={() => void onTest()}>
            {testing ? "Testing…" : "Test connection"}
          </Button>
        </div>
      </div>
      {detail ? <p className="text-xs text-slate-600">{detail}</p> : null}

      <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-xl space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Client ID</label>
          <Input {...form.register("zoomClientId")} autoComplete="off" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Client secret</label>
          <Input
            type="password"
            {...form.register("zoomClientSecret")}
            autoComplete="new-password"
            placeholder={hasStoredZoomSecret ? "Leave blank and save to clear the stored secret" : ""}
          />
          {hasStoredZoomSecret ? (
            <p className="mt-1 text-xs text-slate-500">
              A secret is stored. Enter a new value to replace it, or save with an empty field to remove it.
            </p>
          ) : null}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Account ID</label>
          <Input {...form.register("zoomAccountId")} autoComplete="off" />
        </div>
        {form.formState.errors.root ? (
          <p className="text-sm text-red-600">{form.formState.errors.root.message}</p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Saving…" : "Save Zoom"}
          </Button>
          {hasStored ? (
            <Button
              type="button"
              variant="secondary"
              disabled={form.formState.isSubmitting}
              onClick={() => void onClear()}
            >
              Remove stored credentials
            </Button>
          ) : null}
        </div>
      </form>
    </div>
  );
}

const waSchema = z.object({
  whatsappEnabled: z.preprocess((val) => val === true || val === "on", z.boolean()),
  whatsappAccessToken: z.string().max(8000).optional(),
  whatsappPhoneNumberId: z.string().max(200).optional()
});

type WaFormValues = z.infer<typeof waSchema>;

type WhatsappPanelProps = {
  defaultWhatsappEnabled: boolean;
  defaultPhoneNumberId: string | null;
  hasStoredWhatsappToken: boolean;
};

function WhatsappPanel({
  defaultWhatsappEnabled,
  defaultPhoneNumberId,
  hasStoredWhatsappToken
}: WhatsappPanelProps) {
  const router = useRouter();
  const [health, setHealth] = useState<IntegrationHealth | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  const form = useForm<WaFormValues>({
    resolver: zodResolver(waSchema),
    defaultValues: {
      whatsappEnabled: defaultWhatsappEnabled,
      whatsappAccessToken: "",
      whatsappPhoneNumberId: defaultPhoneNumberId ?? ""
    }
  });

  async function onTest() {
    setTesting(true);
    setDetail(null);
    const res = await testWhatsappIntegration();
    setTesting(false);
    if (!res.success || !res.data) {
      setHealth("action_required");
      setDetail(res.error ?? "Test failed");
      return;
    }
    setHealth(res.data.status);
    setDetail(res.data.detail ?? null);
  }

  async function onSubmit(values: WaFormValues) {
    const tok = values.whatsappAccessToken?.trim() ?? "";
    const res = await updateOrganizationWhatsappFields({
      whatsappEnabled: values.whatsappEnabled,
      whatsappPhoneNumberId: values.whatsappPhoneNumberId?.trim() || null,
      ...(tok.length > 0 ? { whatsappAccessToken: tok } : {})
    });
    if (!res.success) {
      form.setError("root", { message: res.error ?? "Failed to save" });
      return;
    }
    form.reset({ ...values, whatsappAccessToken: "" });
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">WhatsApp</h3>
          <p className="mt-1 text-xs text-slate-600">
            Meta Cloud API access token and Phone number ID for transactional WhatsApp messages.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <HealthBadge status={health} />
          <Button type="button" variant="secondary" disabled={testing} onClick={() => void onTest()}>
            {testing ? "Testing…" : "Test connection"}
          </Button>
        </div>
      </div>
      {detail ? <p className="text-xs text-slate-600">{detail}</p> : null}

      <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-xl space-y-4">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
          <input type="checkbox" className="rounded border-slate-300" {...form.register("whatsappEnabled")} />
          Enable WhatsApp notifications
        </label>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Phone number ID</label>
          <Input {...form.register("whatsappPhoneNumberId")} autoComplete="off" placeholder="From Meta Business" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Permanent access token</label>
          <Input
            type="password"
            {...form.register("whatsappAccessToken")}
            autoComplete="new-password"
            placeholder={hasStoredWhatsappToken ? "Leave blank to keep the saved token" : ""}
          />
          {hasStoredWhatsappToken ? (
            <p className="mt-1 text-xs text-slate-500">A token is already stored. Enter a new value only to replace it.</p>
          ) : null}
        </div>
        {form.formState.errors.root ? (
          <p className="text-sm text-red-600">{form.formState.errors.root.message}</p>
        ) : null}
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Saving…" : "Save WhatsApp"}
        </Button>
      </form>
    </div>
  );
}

const resendSchema = z.object({
  resendApiKey: z.string().max(500).optional()
});

type ResendFormValues = z.infer<typeof resendSchema>;

type ResendPanelProps = {
  hasStoredResendKey: boolean;
};

function ResendPanel({ hasStoredResendKey }: ResendPanelProps) {
  const router = useRouter();
  const [health, setHealth] = useState<IntegrationHealth | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  const form = useForm<ResendFormValues>({
    resolver: zodResolver(resendSchema),
    defaultValues: { resendApiKey: "" }
  });

  async function onTest() {
    setTesting(true);
    setDetail(null);
    const res = await testResendIntegration();
    setTesting(false);
    if (!res.success || !res.data) {
      setHealth("action_required");
      setDetail(res.error ?? "Test failed");
      return;
    }
    setHealth(res.data.status);
    setDetail(res.data.detail ?? null);
  }

  async function onSubmit(values: ResendFormValues) {
    const key = values.resendApiKey?.trim() ?? "";
    if (!key) {
      if (!hasStoredResendKey) {
        form.setError("root", { message: "Enter an API key to save." });
        return;
      }
      return;
    }
    const res = await updateOrganizationResendFields({ resendApiKey: key });
    if (!res.success) {
      form.setError("root", { message: res.error ?? "Failed to save" });
      return;
    }
    form.reset({ resendApiKey: "" });
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Resend</h3>
          <p className="mt-1 text-xs text-slate-600">
            Optional organization API key for email. If empty, the server default key is used. The test checks for a
            verified domain. Sending uses <span className="font-mono text-[11px]">RESEND_FROM</span> on the server
            (defaults to sandbox-only <span className="font-mono text-[11px]">onboarding@resend.dev</span>).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <HealthBadge status={health} />
          <Button type="button" variant="secondary" disabled={testing} onClick={() => void onTest()}>
            {testing ? "Testing…" : "Test connection"}
          </Button>
        </div>
      </div>
      {detail ? <p className="text-xs text-slate-600">{detail}</p> : null}

      <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-xl space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">API key</label>
          <Input
            type="password"
            {...form.register("resendApiKey")}
            autoComplete="new-password"
            placeholder={hasStoredResendKey ? "Leave blank to keep the saved key" : ""}
          />
          {hasStoredResendKey ? (
            <p className="mt-1 text-xs text-slate-500">A key is already stored. Enter a new value only to replace it.</p>
          ) : null}
        </div>
        {form.formState.errors.root ? (
          <p className="text-sm text-red-600">{form.formState.errors.root.message}</p>
        ) : null}
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Saving…" : "Save Resend"}
        </Button>
      </form>
    </div>
  );
}

const mnotifySchema = z.object({
  mnotifyEnabled: z.preprocess((val) => val === true || val === "on", z.boolean()),
  mnotifyApiKey: z.string().max(500).optional(),
  mnotifySenderId: z.string().max(11).optional(),
  clearMnotifyApiKey: z.boolean().optional()
});

type MnotifyFormValues = z.infer<typeof mnotifySchema>;

type MnotifyPanelProps = {
  defaultMnotifyEnabled: boolean;
  defaultMnotifySenderId: string | null;
  mnotifyDefaultSenderId: string;
  hasStoredMnotifyKey: boolean;
};

function MnotifyPanel({
  defaultMnotifyEnabled,
  defaultMnotifySenderId,
  mnotifyDefaultSenderId,
  hasStoredMnotifyKey
}: MnotifyPanelProps) {
  const router = useRouter();
  const [health, setHealth] = useState<IntegrationHealth | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  const form = useForm<MnotifyFormValues>({
    resolver: zodResolver(mnotifySchema),
    defaultValues: {
      mnotifyEnabled: defaultMnotifyEnabled,
      mnotifyApiKey: "",
      mnotifySenderId: defaultMnotifySenderId ?? "",
      clearMnotifyApiKey: false
    }
  });

  async function onTest() {
    setTesting(true);
    setDetail(null);
    const res = await testMnotifyIntegration();
    setTesting(false);
    if (!res.success || !res.data) {
      setHealth("action_required");
      setDetail(res.error ?? "Test failed");
      return;
    }
    setHealth(res.data.status);
    setDetail(res.data.detail ?? null);
    router.refresh();
  }

  async function onSubmit(values: MnotifyFormValues) {
    const key = values.mnotifyApiKey?.trim() ?? "";
    const res = await updateOrganizationMnotifyFields({
      mnotifyEnabled: values.mnotifyEnabled,
      mnotifySenderId: values.mnotifySenderId?.trim().slice(0, 11) || null,
      clearMnotifyApiKey: values.clearMnotifyApiKey === true,
      ...(key.length > 0 ? { mnotifyApiKey: key } : {})
    });
    if (!res.success) {
      form.setError("root", { message: res.error ?? "Failed to save" });
      return;
    }
    form.reset({ ...values, mnotifyApiKey: "", clearMnotifyApiKey: false });
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">mNotify SMS</h3>
          <p className="mt-1 text-xs text-slate-600">
            Ghana Quick Bulk SMS via{" "}
            <a
              href="https://developer.mnotify.com/"
              className="text-sky-700 underline"
              target="_blank"
              rel="noreferrer"
            >
              mNotify API
            </a>
            . Sends use the Quick SMS endpoint (no OTP payload). If you do not save an org API key or sender ID, the
            server uses <code className="rounded bg-slate-100 px-1 text-[11px]">MNOTIFY_API_KEY</code> and{" "}
            <code className="rounded bg-slate-100 px-1 text-[11px]">MNOTIFY_DEFAULT_SENDER_ID</code>             (
            <span className="font-mono">
              {mnotifyDefaultSenderId.length >= 3 ? mnotifyDefaultSenderId : "(not set — add to server .env)"}
            </span>
            ) from the environment.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <HealthBadge status={health} />
          <Button type="button" variant="secondary" disabled={testing} onClick={() => void onTest()}>
            {testing ? "Testing…" : "Test connection"}
          </Button>
        </div>
      </div>
      {detail ? <p className="text-xs text-slate-600">{detail}</p> : null}

      <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-xl space-y-4">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
          <input type="checkbox" className="rounded border-slate-300" {...form.register("mnotifyEnabled")} />
          Enable mNotify SMS (reminders, cancellations)
        </label>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Sender ID (max 11 characters, optional)</label>
          <Input
            {...form.register("mnotifySenderId")}
            autoComplete="off"
            maxLength={11}
            placeholder="Override mNotify sender for this workspace"
          />
          <p className="mt-1 text-xs text-slate-500">
            If left blank, Quick SMS uses{" "}
            <code className="text-[11px]">MNOTIFY_DEFAULT_SENDER_ID</code> from the server (currently{" "}
            <span className="font-mono">
              {mnotifyDefaultSenderId.length >= 3 ? mnotifyDefaultSenderId : "not set"}
            </span>
            ).
          </p>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">API key</label>
          <Input
            type="password"
            {...form.register("mnotifyApiKey")}
            autoComplete="new-password"
            placeholder={hasStoredMnotifyKey ? "Leave blank to keep the saved key" : ""}
          />
          {hasStoredMnotifyKey ? (
            <p className="mt-1 text-xs text-slate-500">A key is already stored. Enter a new value only to replace it.</p>
          ) : null}
          <label className="mt-3 flex cursor-pointer items-start gap-2 text-sm text-slate-700">
            <input type="checkbox" className="mt-0.5 rounded border-slate-300" {...form.register("clearMnotifyApiKey")} />
            <span>
              Remove saved organization API key and use the server default{" "}
              <code className="rounded bg-slate-100 px-1 text-[11px]">MNOTIFY_API_KEY</code> instead.
            </span>
          </label>
        </div>
        {form.formState.errors.root ? (
          <p className="text-sm text-red-600">{form.formState.errors.root.message}</p>
        ) : null}
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Saving…" : "Save mNotify"}
        </Button>
      </form>
    </div>
  );
}

const googleMapsSchema = z.object({
  googleMapsApiKey: z.string().max(500).optional()
});

type GoogleMapsFormValues = z.infer<typeof googleMapsSchema>;

type GoogleMapsPanelProps = {
  hasStoredGoogleMapsKey: boolean;
};

function GoogleMapsPanel({ hasStoredGoogleMapsKey }: GoogleMapsPanelProps) {
  const router = useRouter();
  const [health, setHealth] = useState<IntegrationHealth | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  const form = useForm<GoogleMapsFormValues>({
    resolver: zodResolver(googleMapsSchema),
    defaultValues: { googleMapsApiKey: "" }
  });

  async function onTest() {
    setTesting(true);
    setDetail(null);
    const res = await testGoogleMapsIntegration();
    setTesting(false);
    if (!res.success || !res.data) {
      setHealth("action_required");
      setDetail(res.error ?? "Test failed");
      return;
    }
    setHealth(res.data.status);
    setDetail(res.data.detail ?? null);
  }

  async function onSubmit(values: GoogleMapsFormValues) {
    const key = values.googleMapsApiKey?.trim() ?? "";
    const res = await updateOrganizationGoogleMapsFields({
      googleMapsApiKey: key.length > 0 ? key : null
    });
    if (!res.success) {
      form.setError("root", { message: res.error ?? "Failed to save" });
      return;
    }
    form.reset({ googleMapsApiKey: "" });
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Google Maps Platform</h3>
          <p className="mt-1 text-xs text-slate-600">
            API key for{" "}
            <strong>Places Autocomplete</strong>, <strong>Place Details</strong>, and <strong>Static Maps</strong> used
            when admins create venues from the event form. Restrict the key by HTTP referrer and enable only those APIs.
            Optional fallback: <code className="rounded bg-slate-100 px-1 text-[11px]">GOOGLE_MAPS_API_KEY</code> on the
            server.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <HealthBadge status={health} />
          <Button type="button" variant="secondary" disabled={testing} onClick={() => void onTest()}>
            {testing ? "Testing…" : "Test Places"}
          </Button>
        </div>
      </div>
      {detail ? <p className="text-xs text-slate-600">{detail}</p> : null}

      <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-xl space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">API key</label>
          <Input
            type="password"
            {...form.register("googleMapsApiKey")}
            autoComplete="off"
            placeholder={hasStoredGoogleMapsKey ? "Leave blank and save to clear the stored key" : ""}
          />
          {hasStoredGoogleMapsKey ? (
            <p className="mt-1 text-xs text-slate-500">
              A key is already stored. Enter a new key to replace it, or save with an empty field to remove it from the
              organization (server env fallback still works).
            </p>
          ) : null}
        </div>
        {form.formState.errors.root ? (
          <p className="text-sm text-red-600">{form.formState.errors.root.message}</p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Saving…" : "Save Google Maps key"}
          </Button>
        </div>
      </form>
    </div>
  );
}

export type IntegrationsHubProps = {
  zoomClientId: string | null;
  zoomAccountId: string | null;
  hasStoredZoomSecret: boolean;
  whatsappEnabled: boolean;
  whatsappPhoneNumberId: string | null;
  hasStoredWhatsappToken: boolean;
  hasStoredResendKey: boolean;
  mnotifyEnabled: boolean;
  mnotifySenderId: string | null;
  mnotifyDefaultSenderId: string;
  hasStoredMnotifyKey: boolean;
  hasStoredGoogleMapsKey: boolean;
};

export function IntegrationsHub({
  zoomClientId,
  zoomAccountId,
  hasStoredZoomSecret,
  whatsappEnabled,
  whatsappPhoneNumberId,
  hasStoredWhatsappToken,
  hasStoredResendKey,
  mnotifyEnabled,
  mnotifySenderId,
  mnotifyDefaultSenderId,
  hasStoredMnotifyKey,
  hasStoredGoogleMapsKey
}: IntegrationsHubProps) {
  const searchParams = useSearchParams();
  const raw = searchParams.get("integration") ?? "zoom";
  const active: IntegrationId = INTEGRATIONS.includes(raw as IntegrationId) ? (raw as IntegrationId) : "zoom";

  const subTabs = useCallback(
    () =>
      INTEGRATIONS.map((id) => {
        const isSub = active === id;
        return (
          <Link
            key={id}
            href={integrationHref(id)}
            scroll={false}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium capitalize transition",
              isSub ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            )}
          >
            {INTEGRATION_LABELS[id]}
          </Link>
        );
      }),
    [active]
  );

  return (
    <div className="space-y-6">
      <nav className="flex flex-wrap gap-2 border-b border-slate-100 pb-3">{subTabs()}</nav>

      {active === "zoom" ? (
        <ZoomPanel
          defaultZoomClientId={zoomClientId}
          defaultZoomAccountId={zoomAccountId}
          hasStoredZoomSecret={hasStoredZoomSecret}
        />
      ) : null}
      {active === "whatsapp" ? (
        <WhatsappPanel
          defaultWhatsappEnabled={whatsappEnabled}
          defaultPhoneNumberId={whatsappPhoneNumberId}
          hasStoredWhatsappToken={hasStoredWhatsappToken}
        />
      ) : null}
      {active === "resend" ? <ResendPanel hasStoredResendKey={hasStoredResendKey} /> : null}
      {active === "mnotify" ? (
        <MnotifyPanel
          defaultMnotifyEnabled={mnotifyEnabled}
          defaultMnotifySenderId={mnotifySenderId}
          mnotifyDefaultSenderId={mnotifyDefaultSenderId}
          hasStoredMnotifyKey={hasStoredMnotifyKey}
        />
      ) : null}
      {active === "google_maps" ? <GoogleMapsPanel hasStoredGoogleMapsKey={hasStoredGoogleMapsKey} /> : null}
    </div>
  );
}
