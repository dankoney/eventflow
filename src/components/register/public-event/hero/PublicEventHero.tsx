"use client";

import type { ReactNode } from "react";

import type { PublicEventExperiencePayload } from "@/lib/public-event/experience";
import { resolveHeroStyle, type PublicEventHeroStyle } from "@/lib/public-event/heroStyles";
import type { PublicEventTemplateVariant } from "@/lib/public-event/templates/designTokens";

import type { PublicEventSiteSummary } from "../siteSummary";
import {
  BrandOverlayHeroLayout,
  ConferenceHeroLayout,
  GlassGeometricHeroLayout,
  GradientOverlayHeroLayout,
  ImageHeroLayout,
  LongTitleHeroLayout,
  NoImageHeroLayout,
  SplitMultimediaHeroLayout,
  SponsorFirstHeroLayout,
  VideoCountdownHeroLayout
} from "./heroLayouts";
import type { HeroLayoutContext } from "./heroShared";

export type PublicEventHeroProps = {
  summary: PublicEventSiteSummary;
  experience: PublicEventExperiencePayload;
  variant: PublicEventTemplateVariant;
  eventOver: boolean;
  brandColor?: string;
  onOpenRegister: () => void;
  /** Embedded registration form (Summit conference layout). */
  registerSlot?: ReactNode;
};

function renderHeroLayout(style: PublicEventHeroStyle, ctx: HeroLayoutContext) {
  switch (style) {
    case "brand_overlay":
      return <BrandOverlayHeroLayout ctx={ctx} />;
    case "conference":
      return <ConferenceHeroLayout ctx={ctx} />;
    case "long_title":
      return <LongTitleHeroLayout ctx={ctx} />;
    case "no_image":
      return <NoImageHeroLayout ctx={ctx} />;
    case "image":
      return <ImageHeroLayout ctx={ctx} />;
    case "gradient_overlay":
      return <GradientOverlayHeroLayout ctx={ctx} />;
    case "video_countdown":
      return <VideoCountdownHeroLayout ctx={ctx} />;
    case "split_multimedia":
      return <SplitMultimediaHeroLayout ctx={ctx} />;
    case "sponsor_first":
      return <SponsorFirstHeroLayout ctx={ctx} />;
    case "glass_geometric":
      return <GlassGeometricHeroLayout ctx={ctx} />;
    default:
      return <BrandOverlayHeroLayout ctx={ctx} />;
  }
}

export function PublicEventHero({
  summary,
  experience,
  variant,
  eventOver,
  brandColor,
  onOpenRegister,
  registerSlot
}: PublicEventHeroProps) {
  const style = resolveHeroStyle(experience.hero?.style ?? null, variant);
  const ctx: HeroLayoutContext = {
    summary,
    experience,
    variant,
    eventOver,
    brandColor,
    onOpenRegister,
    registerSlot
  };
  return renderHeroLayout(style, ctx);
}
