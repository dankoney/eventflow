import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { getUserCountSafe } from "@/lib/prisma-connectivity";

export default async function HomePage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  const users = await getUserCountSafe();
  if (!users.ok) {
    redirect("/login");
  }
  if (users.count === 0) redirect("/setup");

  redirect("/login");
}
