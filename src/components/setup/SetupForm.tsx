"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { completeInitialSetup } from "@/lib/actions/setup.actions";
import { slugifyWorkspaceName } from "@/lib/utils";

const schema = z
  .object({
    organizationName: z.string().min(2).max(120),
    slug: z
      .string()
      .min(2)
      .max(60)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens"),
    adminName: z.string().min(2).max(120),
    email: z.string().email(),
    password: z.string().min(8),
    confirmPassword: z.string()
  })
  .superRefine((data, ctx) => {
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Passwords do not match",
        path: ["confirmPassword"]
      });
    }
  });

type FormValues = z.infer<typeof schema>;

export function SetupForm() {
  const router = useRouter();
  const slugTouched = useRef(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      organizationName: "",
      slug: "",
      adminName: "",
      email: "",
      password: "",
      confirmPassword: ""
    }
  });

  const slugField = form.register("slug");
  const { onChange: slugOnChange, ...slugRest } = slugField;

  function maybeAutofillSlug() {
    if (slugTouched.current) return;
    const name = form.getValues("organizationName");
    form.setValue("slug", slugifyWorkspaceName(name), { shouldValidate: true });
  }

  async function onSubmit(values: FormValues) {
    const res = await completeInitialSetup({
      organizationName: values.organizationName,
      slug: values.slug,
      adminName: values.adminName,
      email: values.email,
      password: values.password,
      confirmPassword: values.confirmPassword
    });
    if (!res.success) {
      form.setError("root", { message: res.error ?? "Setup failed" });
      return;
    }
    router.push("/login?setup=complete");
    router.refresh();
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Organization name</label>
        <Input
          {...form.register("organizationName", {
            onBlur: () => maybeAutofillSlug()
          })}
          autoComplete="organization"
        />
        {form.formState.errors.organizationName ? (
          <p className="mt-1 text-sm text-red-600">{form.formState.errors.organizationName.message}</p>
        ) : null}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Workspace slug</label>
        <Input
          {...slugRest}
          placeholder="acme-corp"
          autoComplete="off"
          onChange={(e) => {
            slugTouched.current = true;
            slugOnChange(e);
          }}
        />
        <p className="mt-1 text-xs text-slate-500">Lowercase; unique. Auto-filled from the name until you edit it.</p>
        {form.formState.errors.slug ? (
          <p className="mt-1 text-sm text-red-600">{form.formState.errors.slug.message}</p>
        ) : null}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Your name</label>
        <Input {...form.register("adminName")} autoComplete="name" />
        {form.formState.errors.adminName ? (
          <p className="mt-1 text-sm text-red-600">{form.formState.errors.adminName.message}</p>
        ) : null}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Email (sign-in)</label>
        <Input type="email" {...form.register("email")} autoComplete="email" />
        {form.formState.errors.email ? (
          <p className="mt-1 text-sm text-red-600">{form.formState.errors.email.message}</p>
        ) : null}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
        <Input type="password" {...form.register("password")} autoComplete="new-password" />
        {form.formState.errors.password ? (
          <p className="mt-1 text-sm text-red-600">{form.formState.errors.password.message}</p>
        ) : null}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Confirm password</label>
        <Input type="password" {...form.register("confirmPassword")} autoComplete="new-password" />
        {form.formState.errors.confirmPassword ? (
          <p className="mt-1 text-sm text-red-600">{form.formState.errors.confirmPassword.message}</p>
        ) : null}
      </div>

      {form.formState.errors.root ? (
        <p className="text-sm text-red-600" role="alert">
          {form.formState.errors.root.message}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? "Creating…" : "Create organization and admin"}
      </Button>

      <p className="text-center text-sm text-slate-600">
        Already set up?{" "}
        <Link href="/login" className="font-medium text-sky-700 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
