"use server";

import { AttendMode, EventType, GuestStatus, Role, Tier } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import {
  sendGuestConfirmationInPerson,
  sendGuestConfirmationVirtual
} from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { guestQrToPngBase64, createGuestQrCode } from "@/lib/qr";
import { registerWebinarRegistrant } from "@/lib/zoom";
import { getEventForPublicRegistration } from "@/lib/db/events";
import { getJoinPageAbsoluteUrl } from "@/lib/url";
import { formatDate } from "@/lib/utils";
import { ActionResult, Guest } from "@/types";

const guestBaseSchema = z.object({
  eventId: z.string().min(1),
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional().nullable(),
  company: z.string().optional().nullable(),
  jobTitle: z.string().optional().nullable(),
  tier: z.nativeEnum(Tier),
  mode: z.nativeEnum(AttendMode),
  dietary: z.string().optional().nullable(),
  repId: z.string().optional().nullable()
});

function formatZodError(error: z.ZodError) {
  return error.issues.map((e) => e.message).join("; ");
}

function splitDisplayName(full: string) {
  const t = full.trim();
  const i = t.indexOf(" ");
  if (i === -1) return { firstName: t || "Guest", lastName: "Guest" };
  const first = t.slice(0, i).trim() || "Guest";
  const last = t.slice(i + 1).trim() || "Guest";
  return { firstName: first, lastName: last };
}

function canManageGuests(role: Role) {
  return role === "ADMIN" || role === "MARKETING" || role === "SALES_REP";
}

async function getEventForGuestAction(eventId: string, orgId: string) {
  return prisma.event.findFirst({ where: { id: eventId, orgId } });
}

type GuestCreateInput = {
  eventId: string;
  name: string;
  email: string;
  phone: string | null | undefined;
  company: string | null | undefined;
  jobTitle: string | null | undefined;
  tier: Tier;
  mode: AttendMode;
  dietary: string | null | undefined;
  repId: string | null;
};

type EventForGuestEmail = {
  name: string;
  date: Date;
  location: string;
  zoomMeetingId: string | null;
  zoomPasscode: string | null;
};

async function createGuestWithSideEffects(
  input: GuestCreateInput,
  event: EventForGuestEmail
): Promise<ActionResult<Guest>> {
  const emailNorm = input.email.trim().toLowerCase();

  const dup = await prisma.guest.findFirst({
    where: { eventId: input.eventId, email: emailNorm }
  });
  if (dup) return { success: false, error: "A guest with this email is already on this event." };

  const qrCode = createGuestQrCode(input.eventId, emailNorm);

  let zoomLink: string | null = null;
  try {
    const guest = await prisma.guest.create({
      data: {
        name: input.name,
        email: emailNorm,
        phone: input.phone ?? undefined,
        company: input.company ?? undefined,
        jobTitle: input.jobTitle ?? undefined,
        tier: input.tier,
        mode: input.mode,
        dietary: input.dietary ?? undefined,
        repId: input.repId ?? undefined,
        eventId: input.eventId,
        status: GuestStatus.REGISTERED,
        qrCode
      }
    });

    if (input.mode === AttendMode.VIRTUAL && event.zoomMeetingId) {
      try {
        const { firstName, lastName } = splitDisplayName(input.name);
        zoomLink = await registerWebinarRegistrant(event.zoomMeetingId, {
          email: emailNorm,
          firstName,
          lastName
        });
        await prisma.guest.update({
          where: { id: guest.id },
          data: { zoomLink }
        });
      } catch {
        await prisma.guest.delete({ where: { id: guest.id } });
        return {
          success: false,
          error: "Could not register this guest on Zoom. Check webinar settings and credentials."
        };
      }
    }

    const formattedGuest = await prisma.guest.findUnique({ where: { id: guest.id } });
    if (!formattedGuest) return { success: false, error: "Failed to add guest" };

    try {
      await sendGuestEmailsAfterCreate(formattedGuest, event, zoomLink);
    } catch {
      /* guest is saved; email best-effort */
    }

    revalidatePath(`/events/${input.eventId}/guests`);
    revalidatePath(`/register/${input.eventId}`);
    return { success: true, data: formattedGuest };
  } catch {
    return { success: false, error: "Failed to add guest" };
  }
}

const publicRegisterSchema = guestBaseSchema.omit({ repId: true });

export async function publicRegisterGuest(
  input: z.input<typeof publicRegisterSchema>
): Promise<ActionResult<Guest>> {
  const parsed = publicRegisterSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const event = await getEventForPublicRegistration(parsed.data.eventId);
  if (!event) {
    return { success: false, error: "Registration is not open for this event." };
  }

  if (parsed.data.mode === AttendMode.VIRTUAL && !event.zoomMeetingId) {
    return {
      success: false,
      error: "Virtual attendance is not available for this event."
    };
  }

  const modeOk =
    event.type === EventType.HYBRID ||
    (event.type === EventType.IN_PERSON && parsed.data.mode === AttendMode.IN_PERSON) ||
    (event.type === EventType.VIRTUAL && parsed.data.mode === AttendMode.VIRTUAL);
  if (!modeOk) {
    return { success: false, error: "This attendance mode is not available for this event." };
  }

  const inPersonCount = await prisma.guest.count({
    where: { eventId: event.id, mode: AttendMode.IN_PERSON }
  });
  const virtualCount = await prisma.guest.count({
    where: { eventId: event.id, mode: AttendMode.VIRTUAL }
  });

  if (parsed.data.mode === AttendMode.IN_PERSON && inPersonCount >= event.capacity) {
    return { success: false, error: "In-person registration is full for this event." };
  }
  if (
    parsed.data.mode === AttendMode.VIRTUAL &&
    (event.virtualCapacity <= 0 || virtualCount >= event.virtualCapacity)
  ) {
    return { success: false, error: "Virtual registration is full for this event." };
  }

  return createGuestWithSideEffects(
    {
      eventId: parsed.data.eventId,
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone,
      company: parsed.data.company,
      jobTitle: parsed.data.jobTitle,
      tier: parsed.data.tier,
      mode: parsed.data.mode,
      dietary: parsed.data.dietary,
      repId: null
    },
    event
  );
}

export async function addGuest(
  input: z.input<typeof guestBaseSchema>
): Promise<ActionResult<Guest>> {
  const session = await auth();
  if (!session?.user?.orgId || !canManageGuests(session.user.role)) {
    return { success: false, error: "Unauthorized" };
  }

  const parsed = guestBaseSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) };

  const event = await getEventForGuestAction(parsed.data.eventId, session.user.orgId);
  if (!event) return { success: false, error: "Event not found" };

  if (parsed.data.mode === AttendMode.VIRTUAL && !event.zoomMeetingId) {
    return {
      success: false,
      error:
        "This event has no Zoom webinar. Add virtual capacity on the event or choose in-person attendance."
    };
  }

  let repId = parsed.data.repId?.trim() || null;
  if (session.user.role === "SALES_REP") {
    repId = repId ?? session.user.id;
  }

  return createGuestWithSideEffects(
    {
      eventId: parsed.data.eventId,
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone,
      company: parsed.data.company,
      jobTitle: parsed.data.jobTitle,
      tier: parsed.data.tier,
      mode: parsed.data.mode,
      dietary: parsed.data.dietary,
      repId
    },
    event
  );
}

async function sendGuestEmailsAfterCreate(
  guest: {
    id: string;
    name: string;
    email: string;
    mode: AttendMode;
    qrCode: string | null;
  },
  event: { name: string; date: Date; location: string; zoomMeetingId: string | null; zoomPasscode: string | null },
  zoomLink: string | null
) {
  const eventDate = formatDate(event.date);

  if (guest.mode === AttendMode.IN_PERSON && guest.qrCode) {
    const png = await guestQrToPngBase64(guest.qrCode);
    await sendGuestConfirmationInPerson({
      to: guest.email,
      guestName: guest.name,
      eventName: event.name,
      eventDate,
      location: event.location,
      qrPngBase64: png
    });
    return;
  }

  if (guest.mode === AttendMode.VIRTUAL && zoomLink && event.zoomMeetingId) {
    await sendGuestConfirmationVirtual({
      to: guest.email,
      guestName: guest.name,
      eventName: event.name,
      eventDate,
      zoomJoinUrl: zoomLink,
      meetingId: event.zoomMeetingId,
      passcode: event.zoomPasscode,
      joinPageUrl: getJoinPageAbsoluteUrl(guest.id)
    });
  }
}

export async function importGuestsFromRows(
  eventId: string,
  rows: Array<Record<string, string>>
): Promise<ActionResult<{ count: number }>> {
  const session = await auth();
  if (!session?.user?.orgId || !canManageGuests(session.user.role)) {
    return { success: false, error: "Unauthorized" };
  }

  const event = await getEventForGuestAction(eventId, session.user.orgId);
  if (!event) return { success: false, error: "Event not found" };

  const reps = await prisma.user.findMany({
    where: { orgId: session.user.orgId, role: Role.SALES_REP },
    select: { id: true, email: true }
  });
  const repByEmail = new Map(reps.map((r) => [r.email.toLowerCase(), r.id]));

  let count = 0;
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i];
    const rowIndex = i + 2;
    const repEmail = raw.repEmail?.trim().toLowerCase() || "";
    let repId: string | null = null;
    if (repEmail) {
      const id = repByEmail.get(repEmail);
      if (!id) {
        errors.push(`Row ${rowIndex}: unknown rep email "${repEmail}"`);
        continue;
      }
      repId = id;
    }
    if (session.user.role === "SALES_REP") {
      repId = repId ?? session.user.id;
    }

    const parsed = guestBaseSchema.safeParse({
      eventId,
      name: (raw.name ?? "").trim(),
      email: (raw.email ?? "").trim(),
      phone: raw.phone?.trim() || null,
      company: raw.company?.trim() || null,
      jobTitle: raw.jobTitle?.trim() || null,
      tier: parseTier(raw.tier),
      mode: parseMode(raw.mode),
      dietary: raw.dietary?.trim() || null,
      repId
    });

    if (!parsed.success) {
      errors.push(`Row ${rowIndex}: ${formatZodError(parsed.error)}`);
      continue;
    }

    const res = await addGuest(parsed.data);
    if (res.success) count++;
    else errors.push(`Row ${rowIndex}: ${res.error ?? "Failed"}`);
  }

  if (errors.length && count === 0) {
    return { success: false, error: errors.slice(0, 5).join(" | ") };
  }

  revalidatePath(`/events/${eventId}/guests`);
  if (errors.length) {
    return { success: true, data: { count }, error: `Imported ${count}. Issues: ${errors.slice(0, 3).join(" | ")}` };
  }
  return { success: true, data: { count } };
}

function parseTier(v: string | undefined): Tier {
  const x = (v ?? "C").trim().toUpperCase();
  if (x === "A" || x === "B" || x === "C") return x as Tier;
  return Tier.C;
}

function parseMode(v: string | undefined): AttendMode {
  const x = (v ?? "in_person").trim().toLowerCase().replace(/[-\s]/g, "_");
  if (x === "virtual" || x === "v") return AttendMode.VIRTUAL;
  if (x === "in_person" || x === "inperson") return AttendMode.IN_PERSON;
  return AttendMode.IN_PERSON;
}

export async function updateGuestStatus(
  guestId: string,
  status: GuestStatus
): Promise<ActionResult<Guest>> {
  const session = await auth();
  if (!session?.user?.orgId) return { success: false, error: "Unauthorized" };

  const existing = await prisma.guest.findFirst({
    where: { id: guestId },
    include: { event: true }
  });
  if (!existing || existing.event.orgId !== session.user.orgId) {
    return { success: false, error: "Guest not found" };
  }
  if (session.user.role === "SALES_REP" && existing.repId !== session.user.id) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const guest = await prisma.guest.update({
      where: { id: guestId },
      data: { status }
    });
    revalidatePath(`/events/${guest.eventId}/guests`);
    return { success: true, data: guest };
  } catch {
    return { success: false, error: "Failed to update guest status" };
  }
}
