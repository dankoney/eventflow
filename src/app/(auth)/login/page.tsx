import Link from "next/link";
import { Suspense } from "react";

import { LoginForm } from "@/components/auth/LoginForm";
import { getUserCountSafe } from "@/lib/prisma-connectivity";

type LoginPageProps = {
  searchParams: { callbackUrl?: string; setup?: string; error?: string; activated?: string };
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const users = await getUserCountSafe();
  const setupComplete = searchParams.setup === "complete";
  const activatedSlug = searchParams.activated?.trim() || null;
  const prismaBroken = !users.ok;

  return (
    <section className="w-full rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
      <h1 className="text-xl font-semibold text-slate-900">Sign in to Eventflow</h1>
      <p className="mt-1 text-sm text-slate-600">Enter your work email. We will send a one-time code to sign in.</p>

      {prismaBroken ? (
        <div
          className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-900"
          role="alert"
        >
          {users.message}
        </div>
      ) : null}

      {setupComplete ? (
        <div
          className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900"
          role="status"
        >
          Organization created. Sign in with the admin email; we will email you a one-time code.
        </div>
      ) : null}

      {activatedSlug ? (
        <div
          className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900"
          role="status"
        >
          Workspace <strong>{activatedSlug}</strong> is now active. Enter the admin email below — we&apos;ll send a one-time code.
        </div>
      ) : null}

      {searchParams.error ? (
        <p className="mt-4 text-sm text-red-600" role="alert">
          {searchParams.error === "setup-complete"
            ? "Initial setup is already done. Sign in below."
            : "Something went wrong. Try again."}
        </p>
      ) : null}

      {!prismaBroken && users.count === 0 ? (
        <p className="mt-4 rounded-md border border-sky-100 bg-sky-50 px-3 py-2 text-sm text-sky-900">
          No workspace yet.{" "}
          <Link href="/setup" className="font-medium text-sky-800 underline">
            Create your organization first
          </Link>
          .
        </p>
      ) : null}

      <Suspense
        fallback={
          <p className="mt-6 text-sm text-slate-500" aria-live="polite">
            Loading form…
          </p>
        }
      >
        <div className={prismaBroken ? "pointer-events-none mt-6 opacity-50" : "mt-6"}>
          <LoginForm callbackUrl={searchParams.callbackUrl} />
        </div>
      </Suspense>
    </section>
  );
}
