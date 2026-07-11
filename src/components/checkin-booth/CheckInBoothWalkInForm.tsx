"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { EventBlueprintTemplate } from "@prisma/client";
import { ChevronLeft } from "lucide-react";
import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { BoothPhoneNumberField } from "@/components/checkin-booth/BoothPhoneNumberField";
import {
  kioskBackButtonClass,
  kioskFitViewportClass,
  kioskInputClass,
  kioskLabelClass,
  kioskPrimaryButtonClass
} from "@/components/checkin-booth/kioskClasses";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";
import type { RegistrationProfile } from "@/lib/event-wizard/registrationProfile";
import { guestEmailFieldSchema } from "@/lib/guest/contactRequirements";
import {
  composeE164,
  isValidNationalForDial,
  normalizeNationalDigits,
  parseStoredPhoneToForm
} from "@/lib/phone/publicRegistrationPhone";
import { DEFAULT_PHONE_DIAL } from "@/lib/register/phoneDialOptions";

const boothFormBaseSchema = z.object({
  fullName: z.string().trim().min(2, "Please enter your full name."),
  phoneDialCode: z.string().min(1),
  phoneNational: z.string().trim().min(1, "Mobile number is required."),
  company: z.string().optional(),
  jobTitle: z.string().optional(),
  staffEmployeeId: z.string().optional(),
  department: z.string().optional()
});

function buildBoothFormSchema(emailRequired: boolean) {
  return boothFormBaseSchema
    .extend({ email: guestEmailFieldSchema(emailRequired) })
    .superRefine((data, ctx) => {
      const national = normalizeNationalDigits(data.phoneNational, data.phoneDialCode);
      if (!isValidNationalForDial(data.phoneDialCode, national)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Enter a valid mobile number for the selected country code.",
          path: ["phoneNational"]
        });
      }
    });
}

export type BoothWalkInFormValues = z.infer<ReturnType<typeof buildBoothFormSchema>>;

type CheckInBoothWalkInFormProps = {
  blueprintTemplate: EventBlueprintTemplate;
  registrationProfile: RegistrationProfile;
  emailMandatoryForRegistration?: boolean;
  prefillEmail?: string;
  prefillPhone?: string;
  busy: boolean;
  error: string | null;
  onBack: () => void;
  onSubmit: (values: BoothWalkInFormValues & { phone: string }) => void;
};

export function CheckInBoothWalkInForm({
  blueprintTemplate,
  registrationProfile,
  emailMandatoryForRegistration = true,
  prefillEmail,
  prefillPhone,
  busy,
  error,
  onBack,
  onSubmit
}: CheckInBoothWalkInFormProps) {
  const showStaffFields = blueprintTemplate === EventBlueprintTemplate.INTERNAL_STAFF;

  const schema = useMemo(() => {
    return buildBoothFormSchema(emailMandatoryForRegistration).superRefine((data, ctx) => {
      if (registrationProfile.requireCompany && !data.company?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Company is required for this event.",
          path: ["company"]
        });
      }
      if (registrationProfile.requireJobTitle && !data.jobTitle?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Job title is required for this event.",
          path: ["jobTitle"]
        });
      }
      if (showStaffFields && registrationProfile.requireStaffId && !data.staffEmployeeId?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Staff ID is required for this program.",
          path: ["staffEmployeeId"]
        });
      }
      if (showStaffFields && registrationProfile.requireDepartment && !data.department?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Department is required for this program.",
          path: ["department"]
        });
      }
    });
  }, [registrationProfile, showStaffFields, emailMandatoryForRegistration]);

  const phonePrefill = useMemo(() => parseStoredPhoneToForm(prefillPhone), [prefillPhone]);

  const form = useForm<BoothWalkInFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: "",
      email: prefillEmail ?? "",
      phoneDialCode: phonePrefill.dial || DEFAULT_PHONE_DIAL,
      phoneNational: phonePrefill.national,
      company: "",
      jobTitle: "",
      staffEmployeeId: "",
      department: ""
    }
  });

  useEffect(() => {
    if (prefillEmail) form.setValue("email", prefillEmail);
    if (prefillPhone) {
      const p = parseStoredPhoneToForm(prefillPhone);
      form.setValue("phoneDialCode", p.dial);
      form.setValue("phoneNational", p.national);
    }
  }, [prefillEmail, prefillPhone, form]);

  function handleValid(values: BoothWalkInFormValues) {
    const national = normalizeNationalDigits(values.phoneNational, values.phoneDialCode);
    const phone = composeE164(values.phoneDialCode, national);
    onSubmit({ ...values, phone });
  }

  const labelClass = kioskLabelClass;
  const errorClass = "mt-2 text-sm text-red-600";

  return (
    <form
      onSubmit={(e) => void form.handleSubmit(handleValid)(e)}
      className={cn(
        kioskFitViewportClass,
        "mx-auto w-full max-w-3xl rounded-2xl border border-[#c4c5d9] bg-white p-6 shadow-sm sm:p-8"
      )}
    >
      <button type="button" onClick={onBack} className={kioskBackButtonClass}>
        <ChevronLeft className="h-6 w-6" aria-hidden />
        Back
      </button>

      <div className="shrink-0">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#0040e0]">Walk-in</p>
        <h2 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">Your details</h2>
        <p className="mt-2 text-base text-slate-600 sm:text-lg">
          Complete the form below — same fields as online registration. You&apos;ll be checked in as soon as you
          submit.
        </p>
        <p className="mt-3 rounded-xl border border-[#dde1ff] bg-[#f4f6ff] px-4 py-3 text-sm text-[#434656] sm:text-base">
          Already on the guest list? Go back and choose{" "}
          <strong className="font-semibold text-[#151c27]">Pre-registered</strong> to check in faster.
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
          <div>
            <label className={labelClass}>
              Email
              {emailMandatoryForRegistration ? <span className="text-red-500"> *</span> : " (optional)"}
            </label>
            <Input
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              className={kioskInputClass}
              {...form.register("email")}
            />
            {form.formState.errors.email ? (
              <p className={errorClass}>{form.formState.errors.email.message}</p>
            ) : null}
          </div>

          <div>
            <label className={labelClass}>Full name</label>
            <Input
              autoComplete="name"
              placeholder="e.g. Alex Rivera"
              className={kioskInputClass}
              {...form.register("fullName")}
            />
            {form.formState.errors.fullName ? (
              <p className={errorClass}>{form.formState.errors.fullName.message}</p>
            ) : null}
          </div>

          <div className="sm:col-span-2">
            <BoothPhoneNumberField
              dialCode={form.watch("phoneDialCode")}
              national={form.watch("phoneNational")}
              onDialCodeChange={(v) => form.setValue("phoneDialCode", v, { shouldValidate: true })}
              onNationalChange={(v) => form.setValue("phoneNational", v, { shouldValidate: true })}
              error={form.formState.errors.phoneNational?.message}
              disabled={busy}
              layout="row"
            />
          </div>

          <div>
            <label className={labelClass}>
              Company{registrationProfile.requireCompany ? <span className="text-red-500"> *</span> : " (optional)"}
            </label>
            <Input
              autoComplete="organization"
              placeholder="Where do you work?"
              className={kioskInputClass}
              {...form.register("company")}
            />
            {form.formState.errors.company ? (
              <p className={errorClass}>{form.formState.errors.company.message}</p>
            ) : null}
          </div>

          <div>
            <label className={labelClass}>
              Job title
              {registrationProfile.requireJobTitle ? <span className="text-red-500"> *</span> : " (optional)"}
            </label>
            <Input
              autoComplete="organization-title"
              placeholder="e.g. Product marketing lead"
              className={kioskInputClass}
              {...form.register("jobTitle")}
            />
            {form.formState.errors.jobTitle ? (
              <p className={errorClass}>{form.formState.errors.jobTitle.message}</p>
            ) : null}
          </div>

          {showStaffFields ? (
            <>
              <div>
                <label className={labelClass}>
                  Staff ID
                  {registrationProfile.requireStaffId ? <span className="text-red-500"> *</span> : null}
                </label>
                <Input className={kioskInputClass} {...form.register("staffEmployeeId")} />
                {form.formState.errors.staffEmployeeId ? (
                  <p className={errorClass}>{form.formState.errors.staffEmployeeId.message}</p>
                ) : null}
              </div>
              <div>
                <label className={labelClass}>
                  Department
                  {registrationProfile.requireDepartment ? <span className="text-red-500"> *</span> : null}
                </label>
                <Input className={kioskInputClass} {...form.register("department")} />
                {form.formState.errors.department ? (
                  <p className={errorClass}>{form.formState.errors.department.message}</p>
                ) : null}
              </div>
            </>
          ) : null}
        </div>
      </div>

      <div className="shrink-0 space-y-3 pt-2">
        {error ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-base text-red-700">{error}</p>
        ) : null}

        <Button
          type="submit"
          disabled={busy}
          className={cn(kioskPrimaryButtonClass, "bg-[#0040e0] hover:bg-[#0035be]")}
        >
          {busy ? "Checking in…" : "Check in now"}
        </Button>
      </div>
    </form>
  );
}
