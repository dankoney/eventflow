"use client";

import { signOut } from "next-auth/react";

import { Button } from "@/components/ui/Button";

export function LogoutButton() {
  return (
    <Button type="button" variant="secondary" className="w-full" onClick={() => signOut({ callbackUrl: "/login" })}>
      Sign out
    </Button>
  );
}
