"use client";

import { type CSSProperties, type ReactNode } from "react";

import { Modal } from "@/components/ui/Modal";
import { NIGHT_EDITION_REGISTER_FORM_SHELL } from "@/lib/public-event/registerFormShell";
import { buildPublicEventCssVars } from "@/lib/public-event/templates/theme";
import { cn } from "@/lib/utils";

import type { PublicEventSiteSummary } from "../../../siteSummary";

type Props = {
  open: boolean;
  onClose: () => void;
  summary: PublicEventSiteSummary;
  registrationOpen: boolean;
  brandColor?: string;
  children: ReactNode;
};

/** Registration modal — Template 2 (Night Edition) styling throughout. */
export function NightEditionRegisterModal({
  open,
  onClose,
  summary,
  registrationOpen,
  brandColor,
  children
}: Props) {
  const nightVars = buildPublicEventCssVars("night-edition", brandColor) as CSSProperties;

  return (
    <Modal
      open={open}
      title="Register"
      subtitle={summary.statusMessage}
      onClose={onClose}
      size="lg"
      tone="dark"
      headerTone="dark"
    >
      <div className={cn("pe-theme-night rounded-xl pe-glass-panel p-4 sm:p-6", NIGHT_EDITION_REGISTER_FORM_SHELL)} style={nightVars}>
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
