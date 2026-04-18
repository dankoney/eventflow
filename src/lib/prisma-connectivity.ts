import { prisma } from "@/lib/prisma";

export type UserCountResult =
  | { ok: true; count: number }
  | { ok: false; message: string };

/** Safe for first paint when the Prisma engine fails to load (e.g. Windows ARM + Node arm64). */
export async function getUserCountSafe(): Promise<UserCountResult> {
  try {
    const count = await prisma.user.count();
    return { ok: true, count };
  } catch (e) {
    const hint =
      typeof e === "object" &&
      e !== null &&
      "message" in e &&
      typeof (e as Error).message === "string" &&
      (e as Error).message.includes("not a valid Win32 application")
        ? " This usually means Node’s architecture doesn’t match Prisma’s Windows engine: install Node.js x64 on Windows ARM, or run the app in WSL2 / Linux, then run npx prisma generate."
        : "";

    const base =
      "The database client could not run. Confirm `DATABASE_URL` and that PostgreSQL is reachable.";

    return { ok: false, message: `${base}${hint}` };
  }
}
