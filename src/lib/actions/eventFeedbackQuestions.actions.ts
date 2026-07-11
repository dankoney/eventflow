"use server";

import { EventStatus, Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { type ActionResult } from "@/types";

import {
  FEEDBACK_FORM_LOCKED_MESSAGE,
  isEventFeedbackFormLocked
} from "@/lib/event-feedback/feedbackFormLock";
import { eventFeedbackQuestionsSchema } from "@/lib/event-feedback/feedbackQuestions";

const updateEventFeedbackQuestionsSchema = z.object({
  eventId: z.string().min(1),
  questions: eventFeedbackQuestionsSchema,
  feedbackAnonymous: z.boolean().optional()
});

export async function updateEventFeedbackQuestions(
  input: z.input<typeof updateEventFeedbackQuestionsSchema>
): Promise<ActionResult<{ saved: true }>> {
  const session = await auth();
  if (!session?.user?.orgId || !session.user.id) {
    return { success: false, error: "Unauthorized" };
  }
  if (session.user.role !== Role.ADMIN && session.user.role !== Role.MARKETING) {
    return { success: false, error: "Unauthorized" };
  }

  const parsed = updateEventFeedbackQuestionsSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const [event, responseCount] = await Promise.all([
    prisma.event.findFirst({
      where: { id: parsed.data.eventId, orgId: session.user.orgId },
      select: { id: true, status: true }
    }),
    prisma.eventFeedbackResponse.count({
      where: { eventId: parsed.data.eventId }
    })
  ]);
  if (!event) return { success: false, error: "Event not found." };

  const formLocked = isEventFeedbackFormLocked({
    eventStatus: event.status,
    feedbackResponseCount: responseCount
  });

  if (formLocked) {
    return { success: false, error: FEEDBACK_FORM_LOCKED_MESSAGE };
  }

  await prisma.event.update({
    where: { id: event.id },
    data: {
      feedbackQuestions: parsed.data.questions,
      ...(parsed.data.feedbackAnonymous !== undefined
        ? { feedbackAnonymous: parsed.data.feedbackAnonymous }
        : {})
    }
  });

  revalidatePath(`/events/${event.id}/settings`);
  revalidatePath(`/events/${event.id}/feedback`);
  return { success: true, data: { saved: true } };
}

const updateAnonymousSchema = z.object({
  eventId: z.string().min(1),
  feedbackAnonymous: z.boolean()
});

/** Anonymous mode can be toggled even after the question form is locked. */
export async function updateEventFeedbackAnonymous(
  input: z.input<typeof updateAnonymousSchema>
): Promise<ActionResult<{ saved: true }>> {
  const session = await auth();
  if (!session?.user?.orgId || !session.user.id) {
    return { success: false, error: "Unauthorized" };
  }
  if (session.user.role !== Role.ADMIN && session.user.role !== Role.MARKETING) {
    return { success: false, error: "Unauthorized" };
  }

  const parsed = updateAnonymousSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const event = await prisma.event.findFirst({
    where: { id: parsed.data.eventId, orgId: session.user.orgId },
    select: { id: true }
  });
  if (!event) return { success: false, error: "Event not found." };

  await prisma.event.update({
    where: { id: event.id },
    data: { feedbackAnonymous: parsed.data.feedbackAnonymous }
  });

  revalidatePath(`/events/${event.id}/settings`);
  revalidatePath(`/events/${event.id}/feedback`);
  return { success: true, data: { saved: true } };
}

