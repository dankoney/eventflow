import { EventBlueprintTemplate, EventStatus, GuestStatus, InternalStaffCheckInMode } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/types";

import { internalStaffAudienceForPrisma } from "./audience";
import { insertContactGuestsFromDirectory } from "./bulkGuestsFromContacts";
import { dispatchInternalStaffRosterNotices } from "./dispatchPersonalCheckInLinks";
import { listOrgContactsMatchingAudience } from "./resolveContactsForAudience";

export type ResyncInternalStaffGuestsResult = {
  removed: number;
  added: number;
  targetCount: number;
  /** Populated when new guests were added on a published/live event and notices were dispatched. */
  noticesSent?: {
    emailed: number;
    smsSent: number;
    whatsappSent: number;
  };
};

/**
 * Aligns directory-sourced guests (no QR / no Zoom link, invited) with the current audience.
 * Does not remove guests who already have check-ins or non-invited status, or anyone with QR/Zoom assets.
 */
export async function resyncInternalStaffGuestsForEvent(params: {
  eventId: string;
  orgId: string;
}): Promise<ActionResult<ResyncInternalStaffGuestsResult>> {
  const event = await prisma.event.findFirst({
    where: { id: params.eventId, orgId: params.orgId },
    select: {
      id: true,
      orgId: true,
      type: true,
      status: true,
      blueprintTemplate: true,
      internalStaffAudience: true,
      internalStaffCheckInMode: true
    }
  });

  if (!event) return { success: false, error: "Event not found." };
  if (event.blueprintTemplate !== EventBlueprintTemplate.INTERNAL_STAFF) {
    return { success: false, error: "Guest re-sync applies only to internal staff programs." };
  }

  const audience = internalStaffAudienceForPrisma(
    EventBlueprintTemplate.INTERNAL_STAFF,
    event.internalStaffAudience
  );
  const contacts = await listOrgContactsMatchingAudience(event.orgId, audience);
  const targetEmails = new Set(contacts.map((s) => s.email.trim().toLowerCase()));

  if (targetEmails.size === 0) {
    return {
      success: false,
      error:
        "The current audience matches no contacts. Add contacts or groups in CRM, then widen the audience before re-syncing."
    };
  }

  const issueLinks = event.internalStaffCheckInMode === InternalStaffCheckInMode.PERSONAL_LINK;

  const result = await prisma.$transaction(async (tx) => {
    const del = await tx.guest.deleteMany({
      where: {
        eventId: event.id,
        qrCode: null,
        zoomLink: null,
        status: GuestStatus.INVITED,
        checkIns: { none: {} },
        email: { notIn: [...targetEmails] }
      }
    });

    const added = await insertContactGuestsFromDirectory(tx, event.id, event.type, contacts, {
      issuePersonalCheckInLinks: issueLinks
    });

    for (const s of contacts) {
      const email = s.email.trim().toLowerCase();
      await tx.guest.updateMany({
        where: { eventId: event.id, email },
        data: {
          branch: s.branch?.trim() || null,
          department: s.department?.trim() || undefined
        }
      });
    }

    return { removed: del.count, added, targetCount: contacts.length };
  });

  let noticesSent: ResyncInternalStaffGuestsResult["noticesSent"];
  if (
    result.added > 0 &&
    (event.status === EventStatus.PUBLISHED || event.status === EventStatus.LIVE)
  ) {
    const dispatchResult = await dispatchInternalStaffRosterNotices(event.id, {
      onlyUnnotified: true
    });
    noticesSent = {
      emailed: dispatchResult.emailed,
      smsSent: dispatchResult.smsSent,
      whatsappSent: dispatchResult.whatsappSent
    };
  }

  return { success: true, data: { ...result, noticesSent } };
}
