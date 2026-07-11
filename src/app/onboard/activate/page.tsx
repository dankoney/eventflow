import { AlertTriangle, CheckCircle2 } from "lucide-react";
import Link from "next/link";

import { activateOrgWithToken } from "@/lib/actions/platform.actions";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: { u?: string; t?: string };
};

/**
 * Public workspace activation entry point reached from the welcome email. The
 * token + userId are consumed server-side; on success we redirect via a Link
 * to /login (we can't `redirect()` from a server component AFTER doing work
 * that we want to render — render the success card instead).
 */
export default async function ActivateOrgPage({ searchParams }: PageProps) {
  const userId = (searchParams.u ?? "").trim();
  const token = (searchParams.t ?? "").trim();

  if (!userId || !token) {
    return (
      <ActivationShell title="Bad activation link">
        <ErrorBody
          body="This activation link is missing required parameters. Ask your platform owner to send a fresh link."
        />
      </ActivationShell>
    );
  }

  const result = await activateOrgWithToken({ userId, token });
  if (!result.success || !result.data) {
    return (
      <ActivationShell title="Link unavailable">
        <ErrorBody body={result.error ?? "This activation link could not be redeemed."} />
      </ActivationShell>
    );
  }

  return (
    <ActivationShell title="Workspace activated">
      <div className="flex flex-col items-center text-center">
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
          <CheckCircle2 className="h-9 w-9 text-emerald-700" aria-hidden />
        </div>
        <h1 className="font-[Manrope,Inter,system-ui] text-2xl font-extrabold tracking-tight text-zinc-900 sm:text-3xl">
          You&apos;re ready to sign in
        </h1>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-zinc-600">
          Your Eventflow workspace has been activated and your email verified. From here on,
          every sign-in uses a fresh 6-digit code emailed to you — no password needed.
        </p>
        <Link
          href={`/login?activated=${encodeURIComponent(result.data.orgSlug)}`}
          className="mt-8 inline-flex w-full max-w-xs items-center justify-center rounded-md bg-zinc-900 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800"
        >
          Continue to sign-in
        </Link>
        <p className="mt-6 text-[11px] uppercase tracking-wider text-zinc-400">
          Workspace · {result.data.orgSlug}
        </p>
      </div>
    </ActivationShell>
  );
}

function ActivationShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-[#fdf8f8] font-sans text-zinc-900 antialiased">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
          <p className="font-[Manrope,Inter,system-ui] text-base font-extrabold tracking-tight text-zinc-900">
            Eventflow Pro
          </p>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
            {title}
          </p>
        </div>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-12 sm:px-8 sm:py-16">
        <div className="w-full max-w-[520px] rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm sm:p-10">
          {children}
        </div>
      </main>
      <footer className="border-t border-zinc-200 bg-white px-4 py-3">
        <p className="text-center text-[11px] text-zinc-500">
          Need help? Reply to the activation email or contact your platform owner.
        </p>
      </footer>
    </div>
  );
}

function ErrorBody({ body }: { body: string }) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
        <AlertTriangle className="h-9 w-9 text-amber-700" aria-hidden />
      </div>
      <h1 className="font-[Manrope,Inter,system-ui] text-2xl font-extrabold tracking-tight text-zinc-900 sm:text-3xl">
        Something is off
      </h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-zinc-600">{body}</p>
      <Link
        href="/login"
        className="mt-8 inline-flex w-full max-w-xs items-center justify-center rounded-md border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
      >
        Go to sign-in
      </Link>
    </div>
  );
}
