"use client";

import { type CSSProperties, type ReactNode } from "react";

import { Modal } from "@/components/ui/Modal";
import {
  TECH_NEXUS_LIGHT_REGISTER_FORM_SHELL,
  TECH_NEXUS_REGISTER_FORM_SHELL
} from "@/lib/public-event/registerFormShell";
import type { PublicEventTemplateVariant } from "@/lib/public-event/templates/designTokens";
import { buildPublicEventCssVars, themeRootClass } from "@/lib/public-event/templates/theme";
import { cn } from "@/lib/utils";

import type { PublicEventSiteSummary } from "../../../siteSummary";

type Props = {
  open: boolean;
  onClose: () => void;
  summary: PublicEventSiteSummary;
  registrationOpen: boolean;
  brandColor?: string;
  templateVariant: PublicEventTemplateVariant;
  children: ReactNode;
};

export function TechnexusRegisterModal({
  open,
  onClose,
  summary,
  registrationOpen,
  brandColor,
  templateVariant,
  children
}: Props) {
  const isLight = templateVariant === "technexus-light";
  const vars = buildPublicEventCssVars(templateVariant, brandColor) as CSSProperties;

  return (
    <Modal
      open={open}
      title="Register"
      subtitle={summary.statusMessage}
      onClose={onClose}
      size="lg"
      tone={isLight ? "light" : "dark"}
      headerTone={isLight ? "light" : "dark"}
    >
      <div
        className={cn(
          themeRootClass(templateVariant),
          "rounded-xl p-4 sm:p-6",
          isLight ? "border border-slate-100 bg-[var(--pe-surface-container-lowest)]" : "tn-glass-card",
          isLight ? TECH_NEXUS_LIGHT_REGISTER_FORM_SHELL : TECH_NEXUS_REGISTER_FORM_SHELL
        )}
        style={vars}
      >
        {children}
      </div>
      {!registrationOpen ? (
        <p className="mt-4 text-center text-sm text-[var(--pe-on-surface-variant)]">
          Registration is not available for this program right now.
        </p>
      ) : null}
    </Modal>
  );
}
