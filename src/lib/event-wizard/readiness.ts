import { EventBlueprintTemplate, type EventType } from "@prisma/client";

import { eventRequiresVirtualZoomIntegration } from "@/lib/events/virtualZoomRequirements";
import type { ResourceLinkRow } from "@/lib/event-wizard/resourceLinks";
import type { InternalStaffAudience } from "@/lib/internalStaff/audience";
import type { WizardStepId } from "@/lib/event-wizard/wizardSteps";

export type ReadinessIssue = {
  id: string;
  severity: "block" | "warn";
  message: string;
  /** Wizard form field to highlight when this issue blocks progress. */
  field?:
    | "name"
    | "locationId"
    | "date"
    | "endDate"
    | "type"
    | "virtualCapacity"
    | "enableVirtual"
    | "zoomSessionKind"
    | "bannerImageUrl"
    | "brandLogoUrl"
    | "brandPrimaryColor";
};

export type WizardDraftForReadiness = {
  name: string;
  locationId: string;
  date: Date | null;
  endDate: Date | null;
  type: EventType;
  virtualCapacity: number;
};

export type BrandingDraft = {
  bannerImageUrl: string;
  brandLogoUrl: string;
  brandPrimaryColor: string;
};

export type StaffResourcesReadiness = {
  template: EventBlueprintTemplate;
  internalStaffAudience?: InternalStaffAudience;
  resourceLinks: ResourceLinkRow[];
  branding?: BrandingDraft;
};

export function readinessForStep(
  step: WizardStepId,
  draft: WizardDraftForReadiness,
  orgHasZoomCredentials: boolean,
  extra?: StaffResourcesReadiness
): ReadinessIssue[] {
  const issues: ReadinessIssue[] = [];

  if (step === "branding" && extra?.branding) {
    const { bannerImageUrl, brandLogoUrl, brandPrimaryColor } = extra.branding;
    const checkHttps = (raw: string, id: string, label: string) => {
      const t = raw.trim();
      if (!t) return;
      if ((id === "banner_https" || id === "logo_https") && t.startsWith("/uploads/")) {
        if (t.includes("..") || t.length > 500) {
          issues.push({
            id,
            severity: "block",
            message: `${label} path is invalid.`,
            field: id === "banner_https" ? "bannerImageUrl" : "brandLogoUrl"
          });
        }
        return;
      }
      try {
        const u = new URL(t);
        if (u.protocol !== "https:") {
          issues.push({
            id,
            severity: "block",
            message: `${label} must use https.`,
            field: id === "banner_https" ? "bannerImageUrl" : "brandLogoUrl"
          });
        }
      } catch {
        issues.push({
          id,
          severity: "block",
          message: `${label} must be a valid URL.`,
          field: id === "banner_https" ? "bannerImageUrl" : "brandLogoUrl"
        });
      }
    };
    checkHttps(bannerImageUrl, "banner_https", "Banner image URL");
    checkHttps(brandLogoUrl, "logo_https", "Logo URL");
    const hex = brandPrimaryColor.trim();
    if (hex && !/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hex)) {
      issues.push({
        id: "brand_hex",
        severity: "block",
        message: "Brand primary color must be a hex value like #0f172a.",
        field: "brandPrimaryColor"
      });
    }
  }

  if (step === "event_information") {
    if (!draft.name.trim() || draft.name.trim().length < 2) {
      issues.push({
        id: "name",
        severity: "block",
        message: "Event name is missing or too short.",
        field: "name"
      });
    }
  }

  if (step === "schedule") {
    if (!draft.date || !draft.endDate) {
      issues.push({
        id: "dates",
        severity: "block",
        message: "Start and end times are required.",
        field: "date"
      });
    } else if (draft.endDate.getTime() <= draft.date.getTime()) {
      issues.push({
        id: "dates_order",
        severity: "block",
        message: "Program end must be after program start.",
        field: "endDate"
      });
    }
  }

  if (step === "venue") {
    if (!draft.locationId) {
      issues.push({
        id: "venue",
        severity: "block",
        message: "Venue is missing — pick a location.",
        field: "locationId"
      });
    }
    const needsZoom = eventRequiresVirtualZoomIntegration(draft.type);
    if (needsZoom && !orgHasZoomCredentials) {
      issues.push({
        id: "zoom_org",
        severity: "block",
        message:
          "Zoom is not connected for your organization — add Server-to-Server OAuth under Settings → Integrations, or switch event type to In person.",
        field: "type"
      });
    }
    if (needsZoom && draft.virtualCapacity < 1) {
      issues.push({
        id: "virtual_cap",
        severity: "block",
        message: "Hybrid or virtual programs need at least one virtual seat.",
        field: "virtualCapacity"
      });
    }
  }

  if (step === "staff_policy" && extra?.template === EventBlueprintTemplate.INTERNAL_STAFF) {
    const aud = extra.internalStaffAudience;
    if (!aud) {
      issues.push({
        id: "audience_missing",
        severity: "block",
        message: "Choose who should be on the guest list for this internal staff program."
      });
    } else if (aud.mode === "DEPARTMENTS" && aud.departments.length === 0) {
      issues.push({
        id: "audience_dept",
        severity: "block",
        message: "Pick at least one department for the audience filter."
      });
    } else if (aud.mode === "RANKS" && aud.ranks.length === 0) {
      issues.push({
        id: "audience_rank",
        severity: "block",
        message: "Pick at least one rank for the audience filter."
      });
    } else if (aud.mode === "EMPLOYMENT_STATUS" && aud.employmentStatuses.length === 0) {
      issues.push({
        id: "audience_status",
        severity: "block",
        message: "Pick at least one employment status."
      });
    } else if (aud.mode === "CRM_KINDS" && aud.crmKinds.length === 0) {
      issues.push({
        id: "audience_crm_kind",
        severity: "block",
        message: "Pick at least one contact type."
      });
    } else if (aud.mode === "GROUPS" && aud.groupIds.length === 0) {
      issues.push({
        id: "audience_groups",
        severity: "block",
        message: "Pick at least one CRM group."
      });
    } else if (aud.mode === "MANUAL" && aud.contactIds.length === 0) {
      issues.push({
        id: "audience_manual",
        severity: "block",
        message: "Select at least one contact for a manual audience."
      });
    }
  }

  if (step === "resources" && extra?.template === EventBlueprintTemplate.TRAINING_WORKSHOP) {
    const valid = extra.resourceLinks.filter((r) => r.title.trim() && r.url.trim());
    if (valid.length === 0) {
      issues.push({
        id: "resources_empty",
        severity: "warn",
        message: "No session materials linked yet — you can add links later from the event page."
      });
    }
  }

  return issues;
}

export function hasBlockingIssues(issues: ReadinessIssue[]): boolean {
  return issues.some((i) => i.severity === "block");
}
