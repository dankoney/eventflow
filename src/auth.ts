import { randomUUID } from "crypto";

import { PrismaAdapter } from "@auth/prisma-adapter";
import { Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";

import { prisma } from "@/lib/prisma";

const credentialsSchema = z.object({
  email: z.string().email(),
  code: z.string().regex(/^\d{6}$/)
});

/** Surfaces on the login form via signIn(..., { redirect: false }).code */
class WorkspaceNotActivated extends CredentialsSignin {
  code = "workspace_not_activated";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- nested @auth/core adapter types differ
  adapter: PrismaAdapter(prisma) as any,
  session: { strategy: "jwt" },
  trustHost: true,
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: "/login"
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        code: { label: "Code", type: "text" }
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const email = parsed.data.email.trim().toLowerCase();

        const user = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            orgId: true,
            isPlatformOwner: true,
            /**
             * Sign-in is denied when the workspace hasn't been activated yet
             * (admin hasn't clicked the link in their welcome email). Platform
             * owners are exempt — they need to be able to manage workspaces
             * regardless of activation state.
             */
            org: {
              select: {
                activatedAt: true
              }
            }
          }
        });
        if (!user) return null;
        if (!user.isPlatformOwner && user.org.activatedAt === null) {
          throw new WorkspaceNotActivated();
        }

        /**
         * Suspended orgs may still complete OTP sign-in. The dashboard layout
         * redirects them to /billing/suspended so they can renew — blocking
         * authorize() left them with a misleading "invalid code" and no renew path.
         * Do not clear activatedAt for billing; that field is onboarding-only.
         */

        const rows = await prisma.verificationToken.findMany({
          where: { identifier: email, expires: { gt: new Date() } }
        });

        for (const row of rows) {
          const ok = await bcrypt.compare(parsed.data.code, row.token);
          if (ok) {
            await prisma.verificationToken.deleteMany({ where: { identifier: email } });
            return {
              id: user.id,
              email: user.email,
              name: user.name,
              role: user.role,
              orgId: user.orgId,
              isPlatformOwner: user.isPlatformOwner
            };
          }
        }

        return null;
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role: Role }).role;
        token.orgId = (user as { orgId: string }).orgId;
        token.isPlatformOwner = (user as { isPlatformOwner: boolean }).isPlatformOwner;
        token.sessionId = randomUUID();
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.sessionId =
          typeof token.sessionId === "string" ? token.sessionId : null;
        const dbUser = await prisma.user.findUnique({
          where: { id: token.sub },
          select: { name: true, email: true, role: true, orgId: true, isPlatformOwner: true }
        });
        if (dbUser) {
          session.user.name = dbUser.name;
          session.user.email = dbUser.email;
          session.user.role = dbUser.role;
          session.user.orgId = dbUser.orgId;
          session.user.isPlatformOwner = dbUser.isPlatformOwner;
        } else {
          session.user.role = (token.role as Role | undefined) ?? Role.STAFF;
          session.user.orgId = (token.orgId as string | undefined) ?? "";
          session.user.isPlatformOwner = Boolean(token.isPlatformOwner);
        }
      }
      return session;
    }
  }
});
