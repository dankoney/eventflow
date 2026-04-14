import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { SetupForm } from "@/components/setup/SetupForm";
import { getUserCountSafe } from "@/lib/prisma-connectivity";

export default async function SetupPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  const users = await getUserCountSafe();
  if (!users.ok) {
    return (
      <section className="w-full rounded-xl border border-red-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Database client unavailable</h1>
        <p className="mt-3 text-sm text-red-800">{users.message}</p>
        <p className="mt-6 text-sm">
          <Link href="/login" className="font-medium text-sky-700 hover:underline">
            Back to sign in
          </Link>
        </p>
      </section>
    );
  }
  if (users.count > 0) {
    redirect("/login");
  }

  return (
    <section className="w-full rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
      <h1 className="text-xl font-semibold text-slate-900">Welcome to Eventflow</h1>
      <p className="mt-1 text-sm text-slate-600">
        Create your organization and the first admin account.
      </p>
      <div className="mt-6">
        <SetupForm />
      </div>
      <p className="mt-6 text-center text-xs text-slate-500">
        By continuing you agree this workspace is for your organization&apos;s use.
      </p>
    </section>
  );
}
