"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { requestLoginOtp } from "@/lib/actions/auth.actions";
import { cn } from "@/lib/utils";

const emailStepSchema = z.object({
  email: z.string().email("Enter a valid email address")
});

const otpStepSchema = z.object({
  email: z.string().email(),
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code from your email")
});

type EmailStepValues = z.infer<typeof emailStepSchema>;
type OtpStepValues = z.infer<typeof otpStepSchema>;

type LoginFormProps = {
  callbackUrl?: string;
};

export function LoginForm({ callbackUrl }: LoginFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [formError, setFormError] = useState<string | null>(null);
  const [step, setStep] = useState<"email" | "code">("email");
  const [pendingEmail, setPendingEmail] = useState("");

  const resolvedCallback =
    callbackUrl ?? searchParams.get("callbackUrl") ?? "/dashboard";

  const emailForm = useForm<EmailStepValues>({
    resolver: zodResolver(emailStepSchema),
    defaultValues: { email: "" }
  });

  const otpForm = useForm<OtpStepValues>({
    resolver: zodResolver(otpStepSchema),
    defaultValues: { email: "", code: "" }
  });

  async function onEmailStep(values: EmailStepValues) {
    setFormError(null);
    const res = await requestLoginOtp({ email: values.email });
    if (!res.success) {
      setFormError(res.error ?? "Could not send code");
      return;
    }
    const email = values.email.trim().toLowerCase();
    setPendingEmail(email);
    otpForm.reset({ email, code: "" });
    setStep("code");
  }

  async function onOtpStep(values: OtpStepValues) {
    setFormError(null);
    const result = await signIn("credentials", {
      email: values.email.trim().toLowerCase(),
      code: values.code.trim(),
      redirect: false
    });

    if (result?.error) {
      if (result.code === "workspace_not_activated") {
        setFormError(
          "This workspace is not activated yet. Open the activation link from your welcome email, or ask your platform admin to resend it."
        );
        return;
      }
      setFormError("Invalid or expired code. Request a new code from the previous step.");
      return;
    }

    router.push(resolvedCallback.startsWith("/") ? resolvedCallback : "/dashboard");
    router.refresh();
  }

  if (step === "code") {
    return (
      <form onSubmit={otpForm.handleSubmit(onOtpStep)} className="mt-6 space-y-4">
        <input type="hidden" {...otpForm.register("email")} />
        <p className="text-sm text-slate-600">
          We sent a 6-digit code to <span className="font-medium text-slate-900">{pendingEmail}</span>.
        </p>
        <div>
          <label htmlFor="code" className="mb-1 block text-sm font-medium text-slate-700">
            Sign-in code
          </label>
          <Input
            id="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="000000"
            aria-invalid={!!otpForm.formState.errors.code}
            className={cn(otpForm.formState.errors.code && "border-red-500 focus:ring-red-400")}
            {...otpForm.register("code")}
          />
          {otpForm.formState.errors.code && (
            <p className="mt-1 text-sm text-red-600">{otpForm.formState.errors.code.message}</p>
          )}
        </div>

        {formError && (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
            {formError}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={otpForm.formState.isSubmitting}>
          {otpForm.formState.isSubmitting ? "Signing in…" : "Verify and sign in"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="w-full"
          onClick={() => {
            setStep("email");
            setFormError(null);
          }}
        >
          Use a different email
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={emailForm.handleSubmit(onEmailStep)} className="mt-6 space-y-4">
      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">
          Email
        </label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          aria-invalid={!!emailForm.formState.errors.email}
          className={cn(emailForm.formState.errors.email && "border-red-500 focus:ring-red-400")}
          {...emailForm.register("email")}
        />
        {emailForm.formState.errors.email && (
          <p className="mt-1 text-sm text-red-600">{emailForm.formState.errors.email.message}</p>
        )}
      </div>

      {formError && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {formError}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={emailForm.formState.isSubmitting}>
        {emailForm.formState.isSubmitting ? "Sending code…" : "Continue with email"}
      </Button>
    </form>
  );
}
