import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { EventForm } from "@/components/events/EventForm";
import { EventPublicRegistrationCard } from "@/components/events/EventPublicRegistrationCard";
import { EventWalkInAccessCard } from "@/components/events/EventWalkInAccessCard";
import { InternalStaffAudienceEditPanel } from "@/components/events/InternalStaffAudienceEditPanel";
import { WorkspacePageShell } from "@/components/ui/WorkspacePageShell";
import { getEventForUser } from "@/lib/db/events";
import {
  distinctOrgContactFieldValues,
  getOrgContactCategoryLabels,
  listOrgContactsForWizardPick
} from "@/lib/db/orgContact";
import { listOrgContactGroupsForOrg } from "@/lib/db/crm";
import { listLocationsForOrg } from "@/lib/db/locations";
import { isGoogleMapsConfigured } from "@/lib/maps/googleMapsConfigured";
import { formatLocationLine } from "@/lib/utils";
import { prisma } from "@/lib/prisma";
import { resolveDefaultEventBrandColors } from "@/lib/email/defaultEventBranding";
import { parseMultiDayConfig } from "@/lib/event-schedule/multiDayConfig";
import { parseRegistrationProfile } from "@/lib/event-wizard/registrationProfile";
import { parseInternalStaffMealMenuItems, parseInternalStaffMealMenusByBranch } from "@/lib/internalStaff/mealMenu";
import { EventBlueprintTemplate, EventStatus, InternalStaffMealMenuScope } from "@prisma/client";

type PageProps = { params: { id: string } };

export default async function EditEventPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN" && session.user.role !== "MARKETING") {
    redirect("/events");
  }

  const [event, locations, orgMaps, contactPickList, distinctContacts, presetCategories, groups, orgBranding] =
    await Promise.all([
    getEventForUser(params.id, session.user.orgId, session.user.id, session.user.role),
    listLocationsForOrg(session.user.orgId),
    prisma.organization.findUnique({
      where: { id: session.user.orgId },
      select: { googleMapsApiKey: true }
    }),
    listOrgContactsForWizardPick(session.user.orgId),
    distinctOrgContactFieldValues(session.user.orgId),
    getOrgContactCategoryLabels(session.user.orgId),
    listOrgContactGroupsForOrg(session.user.orgId),
    prisma.organization.findUnique({
      where: { id: session.user.orgId },
      select: {
        name: true,
        internalStaffFooterContact: true,
        logoUrl: true,
        logo: true,
        defaultEventBrandLogoUrl: true,
        defaultEventBrandPrimaryColor: true,
        defaultEventBrandSecondaryColor: true,
        defaultEventBrandTertiaryColor: true
      }
    })
  ]);

  const staffDirectoryMeta = {
    contactPickList,
    departments: distinctContacts.departments,
    ranks: distinctContacts.ranks,
    categories: distinctContacts.categories,
    presetCategories: presetCategories,
    groups
  };
  const hasGoogleMaps = isGoogleMapsConfigured(orgMaps?.googleMapsApiKey);

  if (!event) notFound();
  if (!orgBranding) notFound();

  const enableVirtual = event.virtualCapacity > 0;
  const multiDay = parseMultiDayConfig(event.multiDayConfig);
  const locked = event.status === EventStatus.COMPLETED || event.status === EventStatus.CANCELLED;
  const showInternalAudience = event.blueprintTemplate === EventBlueprintTemplate.INTERNAL_STAFF;
  const registrationProfile = parseRegistrationProfile(event.registrationProfile);

  return (
    <WorkspacePageShell
      titleLevel="h2"
      kicker="Edit"
      title="Event settings"
      description="Use the stepped editor: Event information, Schedule, Venue, and Branding. Connect & reminders (email, WhatsApp, SMS) live under the event’s Settings tab (after Analytics)."
    >
      <div className="max-w-4xl space-y-6">
        <EventForm
          mode="edit"
          eventId={event.id}
          eventStatus={event.status}
          locations={locations}
          hasGoogleMaps={hasGoogleMaps}
          zoomSessionKindLocked={!!event.zoomMeetingId}
          defaultValues={{
            name: event.name,
            description: event.description ?? "",
            date: event.date,
            endDate: event.endDate,
            locationId: event.locationId,
            capacity: event.capacity,
            enableVirtual,
            virtualCapacity: event.virtualCapacity || 50,
            type: event.type,
            scheduleMode: event.scheduleMode,
            multiDayDays:
              multiDay?.days.map((d) => ({
                startsAt: d.startsAt,
                endsAt: d.endsAt,
                zoomJoinUrl: d.zoomJoinUrl ?? ""
              })) ?? [],
            multiDayVirtualLinkMode: multiDay?.virtualLinkMode ?? "SHARED",
            multiDayRegistrationPolicy: multiDay?.registrationPolicy ?? "OPEN_UNTIL_EVENT_END",
            multiDayCheckInPolicy: multiDay?.checkInPolicy ?? "ONCE_FOR_EVENT",
            multiDayShowAgendaPublic: multiDay?.showDayAgendaPublic ?? true,
            multiDayAllowStaffCheckInOutsideSession: multiDay?.allowStaffCheckInOutsideSession ?? false,
            historicalMode: event.date.getTime() < Date.now(),
            reminderPrimaryEnabled: event.reminderPrimaryEnabled,
            reminderPrimaryHoursBefore: event.reminderPrimaryHoursBefore as 24 | 48 | 72,
            reminderPrimaryEmail: event.reminderPrimaryEmail,
            reminderPrimaryWhatsapp: event.reminderPrimaryWhatsapp,
            reminderPrimarySms: event.reminderPrimarySms,
            reminderFinalEnabled: event.reminderFinalEnabled,
            reminderFinalHoursBefore: event.reminderFinalHoursBefore as 1 | 2 | 5,
            reminderFinalWhatsapp: event.reminderFinalWhatsapp,
            reminderFinalSms: event.reminderFinalSms,
            zoomSessionKind: event.zoomSessionKind,
            bannerImageUrl: event.bannerImageUrl ?? "",
            brandLogoUrl: event.brandLogoUrl ?? "",
            attendeeTheme: event.attendeeTheme,
            publicPageTemplate: event.publicPageTemplate,
            brandPrimaryColor: event.brandPrimaryColor ?? ""
          }}
        />
        <EventPublicRegistrationCard
          eventId={event.id}
          readOnly={locked}
          initialAllowPublicRegistration={event.allowPublicRegistration}
          initialEnableSavedProfileLookup={registrationProfile.enableSavedProfileLookup}
          publicRegisterUrl={`/register/${event.id}`}
        />
        {!showInternalAudience ? (
          <EventWalkInAccessCard
            eventId={event.id}
            readOnly={locked}
            initialAllowFlashEntry={event.allowFlashEntry}
          />
        ) : null}
        {showInternalAudience ? (
          <div className="overflow-hidden rounded-2xl border-2 border-zinc-900 bg-zinc-50 shadow-[6px_6px_0_0_rgb(24_24_27)]">
            <div className="border-b border-zinc-200 bg-white px-4 py-4 sm:px-6 sm:py-5">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500">Internal staff program</p>
              <h2 className="mt-2 text-lg font-bold tracking-tight text-zinc-900">
                Audience, check-in & meals
              </h2>
              <p className="mt-1 text-sm text-zinc-600">
                Internal-staff blueprint only. Saves separately from the wizard above.
              </p>
            </div>
            <div className="bg-white px-4 py-5 sm:px-6 sm:py-6">
              <InternalStaffAudienceEditPanel
                key={event.updatedAt.toISOString()}
                eventId={event.id}
                readOnly={locked}
                initialAudience={event.internalStaffAudience}
                initialAllowFlashEntry={event.allowFlashEntry}
                initialCheckInMode={event.internalStaffCheckInMode}
                initialMealMenuEnabled={event.internalStaffMealMenuEnabled}
                initialMealMenuScope={event.internalStaffMealMenuScope ?? InternalStaffMealMenuScope.ALL_STAFF}
                initialMealMenuItems={parseInternalStaffMealMenuItems(event.internalStaffMealMenuItems)}
                initialMealMenusByBranch={parseInternalStaffMealMenusByBranch(event.internalStaffMealMenusByBranch)}
                initialNoticeKind={event.internalStaffNoticeKind}
                initialNoticeTo={event.internalStaffNoticeTo}
                initialNoticeFrom={event.internalStaffNoticeFrom}
                initialNoticeCc={event.internalStaffNoticeCc}
                initialNoticeContext={event.internalStaffNoticeContext}
                initialMeetingRoom={event.internalStaffMeetingRoom}
                initialNoticeSubject={event.internalStaffNoticeSubject}
                initialEmailTemplateKind={event.internalStaffEmailTemplateKind}
                initialSmsTemplateKind={event.internalStaffSmsTemplateKind}
                initialSmsCustomText={event.internalStaffSmsCustomText}
                initialEmailMailyJson={event.internalStaffEmailMailyJson}
                staffDirectoryMeta={staffDirectoryMeta}
                eventName={event.name}
                eventDateIso={event.date.toISOString()}
                eventType={event.type}
                zoomJoinUrl={event.zoomJoinUrl}
                locationLabel={formatLocationLine(event.location)}
                eventDescription={event.description ?? null}
                orgName={orgBranding.name}
                orgInternalStaffFooterContact={orgBranding.internalStaffFooterContact ?? null}
                orgLogoUrl={null}
                brandColors={resolveDefaultEventBrandColors(orgBranding, { brandPrimaryColor: event.brandPrimaryColor ?? null })}
              />
            </div>
          </div>
        ) : null}
      </div>
    </WorkspacePageShell>
  );
}
