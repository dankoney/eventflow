import { Role } from "@prisma/client";
import "next-auth";

declare module "next-auth" {
  interface Session {
    /** Rotates on each sign-in — scopes staff walk-in PII to the active session. */
    sessionId: string | null;
    user: {
      id: string;
      role: Role;
      orgId: string;
      /** Platform-level superadmin — has access to /superadmin to provision orgs. */
      isPlatformOwner: boolean;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }

  interface User {
    role: Role;
    orgId: string;
    isPlatformOwner: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: Role;
    orgId?: string;
    isPlatformOwner?: boolean;
    sessionId?: string;
  }
}
