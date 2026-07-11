import { Prisma } from "@prisma/client";

/** User-facing message for failed Prisma writes (create/update). */
export function formatPrismaWriteError(error: unknown, context: string): string {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      const target = Array.isArray(error.meta?.target)
        ? (error.meta.target as string[]).join(", ")
        : String(error.meta?.target ?? "field");
      return `${context}: a record with this ${target} already exists.`;
    }
    if (error.code === "P2003") {
      return `${context}: a linked record is missing or invalid (check venue and organization).`;
    }
    if (error.code === "P2025") {
      return `${context}: the record was not found — refresh and try again.`;
    }
    return `${context}: database error (${error.code}). ${error.message}`;
  }
  if (error instanceof Prisma.PrismaClientValidationError) {
    const hint = error.message.includes("Unknown argument")
      ? " The server received a field that is not stored on the event — contact support if this persists."
      : "";
    return `${context}: invalid data sent to the database.${hint}`;
  }
  if (error instanceof Error) {
    return `${context}: ${error.message}`;
  }
  return `${context}: an unexpected error occurred.`;
}
