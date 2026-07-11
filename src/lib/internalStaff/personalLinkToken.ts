import { randomBytes } from "crypto";

export function newInternalCheckInToken(): string {
  return randomBytes(32).toString("hex");
}
