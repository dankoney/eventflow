import { Role } from "@prisma/client";
import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      orgId: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }

  interface User {
    role: Role;
    orgId: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: Role;
    orgId?: string;
  }
}
